import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/* ── role-based system prompt fragments ── */
function buildRoleBlock(role: string): string {
  switch (role) {
    case "owner":
      return `Eres el asistente del dueño del negocio. Tiene acceso completo: finanzas, tesorería, configuración, empleados, inventario, POS, reportes, planes y suscripciones. Puedes responder sobre cualquier tema del negocio.`;
    case "manager":
      return `Eres el asistente de un gerente. Puede ver: empleados, POS, inventario, servicios, caja, reportes y ventas. NO puede ver finanzas (Tesorería), configuración del negocio, planes ni suscripciones. Si pregunta sobre esos temas, indícale que contacte al dueño.`;
    case "seller":
    case "employee":
      return `Eres el asistente de un vendedor/empleado. Solo puede usar: Mi Empleo, POS, Servicios, Caja y Ventas. NO puede ver inventario, reportes, empleados, finanzas ni configuración. Si pregunta sobre esos temas, indícale que contacte a su gerente.`;
    case "partner":
      return `Eres el asistente de un socio (Partner). Solo tiene acceso al módulo Mi Red. No puede ver operaciones de negocios individuales. Si pregunta sobre otros módulos, explícale que su acceso se limita a la gestión de su red.`;
    default:
      return `Eres un asistente general. Responde de forma útil y concisa.`;
  }
}

/* ── Fetch real business data based on active module ── */
async function fetchModuleContext(
  supabase: any,
  business_id: string | null,
  active_module: string | null
): Promise<string> {
  if (!business_id || !active_module) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  try {
    switch (active_module) {
      case "tesoreria": {
        const { data } = await supabase
          .from("treasury_movements")
          .select("amount, type")
          .eq("business_id", business_id)
          .gte("created_at", todayISO);
        if (!data || data.length === 0) return "";
        let income = 0, expense = 0;
        for (const r of data) {
          if (r.type === "income") income += Number(r.amount);
          else if (r.type === "expense") expense += Number(r.amount);
        }
        return `Datos de hoy — Ingresos: $${income.toFixed(2)}, Gastos: $${expense.toFixed(2)}, Balance: $${(income - expense).toFixed(2)}`;
      }
      case "pos":
      case "sales": {
        const { data } = await supabase
          .from("sales")
          .select("total")
          .eq("business_id", business_id)
          .eq("status", "completed")
          .gte("created_at", todayISO);
        if (!data || data.length === 0) return "";
        const count = data.length;
        const total = data.reduce((s: number, r: any) => s + Number(r.total), 0);
        const avg = count > 0 ? total / count : 0;
        return `Ventas de hoy — Cantidad: ${count}, Total: $${total.toFixed(2)}, Ticket promedio: $${avg.toFixed(2)}`;
      }
      case "inventory": {
        const { data } = await supabase
          .from("products")
          .select("name, stock_quantity")
          .eq("business_id", business_id)
          .gt("stock_quantity", 0)
          .order("stock_quantity", { ascending: true })
          .limit(5);
        if (!data || data.length === 0) return "";
        const items = data.map((p: any) => `${p.name} (${p.stock_quantity})`).join(", ");
        return `Productos con stock bajo: ${items}`;
      }
      case "caja": {
        const { data } = await supabase
          .from("cash_register_movements")
          .select("amount, movement_type")
          .eq("business_id", business_id)
          .gte("created_at", todayISO);
        if (!data || data.length === 0) return "";
        let ins = 0, outs = 0;
        for (const r of data) {
          if (r.movement_type === "insertion") ins += Number(r.amount);
          else if (r.movement_type === "extraction") outs += Number(r.amount);
        }
        return `Movimientos de caja hoy — Entradas: $${ins.toFixed(2)}, Salidas: $${outs.toFixed(2)}`;
      }
      case "employees": {
        const { count } = await supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business_id);
        if (!count) return "";
        return `Empleados activos: ${count}`;
      }
      default:
        return "";
    }
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing Groq API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, role, active_module, business_id } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* ── Supabase client for DB reads ── */
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    /* ── Read assistant_config ── */
    const { data: config } = await supabase
      .from("assistant_config")
      .select("tone, base_instructions, assistant_name")
      .limit(1)
      .single();

    const tone = config?.tone || "friendly";
    const baseInstructions = config?.base_instructions || "";
    const assistantName = config?.assistant_name || "Bivoo";

    /* ── Read training examples ── */
    const { data: examples } = await supabase
      .from("assistant_training_examples")
      .select("question, answer")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(5);

    let trainingBlock = "";
    if (examples && examples.length > 0) {
      trainingBlock =
        "\n\nEjemplos de referencia:\n" +
        examples
          .map(
            (e: any, i: number) =>
              `${i + 1}. Pregunta: "${e.question}"\n   Respuesta: "${e.answer}"`
          )
          .join("\n");
    }

    /* ── Read per-module instructions + quick questions ── */
    let moduleInstructionsBlock = "";
    let quickQuestionsBlock = "";
    if (active_module) {
      // Map route to module_key (handle route variations)
      const routeToKey: Record<string, string> = {
        dashboard: "dashboard", pos: "pos", inventory: "inventario", inventario: "inventario",
        services: "servicios", servicios: "servicios", sales: "ventas", ventas: "ventas",
        reportes: "reportes", employees: "empleados", empleados: "empleados",
        nomina: "nomina", caja: "caja", contabilidad: "contabilidad",
        orders: "pedidos", pedidos: "pedidos", "store-settings": "portal", portal: "portal",
        "my-employment": "mi_empleo", mi_empleo: "mi_empleo",
        "mi-red": "mi_red", "partner-dashboard": "mi_red",
      };
      const moduleKey = routeToKey[active_module] || active_module;
      const [modInstrRes, quickQRes] = await Promise.all([
        supabase
          .from("assistant_module_instructions")
          .select("instructions")
          .eq("module_key", moduleKey)
          .limit(1)
          .single(),
        supabase
          .from("assistant_quick_questions")
          .select("question, answer")
          .eq("module_key", moduleKey)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(10),
      ]);
      if (modInstrRes.data?.instructions?.trim()) {
        moduleInstructionsBlock = `\n\nINSTRUCCIONES DEL MÓDULO (${moduleKey}):\n${modInstrRes.data.instructions.slice(0, 800)}`;
      }
      const qqWithAnswers = (quickQRes.data || []).filter((q: any) => q.answer?.trim());
      if (qqWithAnswers.length > 0) {
        quickQuestionsBlock = "\n\nPREGUNTAS FRECUENTES DEL MÓDULO:\n" +
          qqWithAnswers.map((q: any, i: number) =>
            `${i + 1}. P: "${q.question}"\n   R: "${q.answer}"`
          ).join("\n");
      }
    }

    // Also load general quick questions with answers (no module_key)
    const { data: generalQQ } = await supabase
      .from("assistant_quick_questions")
      .select("question, answer")
      .is("module_key", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(10);
    const generalQQWithAnswers = (generalQQ || []).filter((q: any) => q.answer?.trim());
    let generalQQBlock = "";
    if (generalQQWithAnswers.length > 0) {
      generalQQBlock = "\n\nPREGUNTAS FRECUENTES GENERALES:\n" +
        generalQQWithAnswers.map((q: any, i: number) =>
          `${i + 1}. P: "${q.question}"\n   R: "${q.answer}"`
        ).join("\n");
    }

    /* ── Fetch real-time module context ── */
    const contextData = await fetchModuleContext(supabase, business_id, active_module);

    /* ── Build system prompt ── */
    const moduleContext = active_module
      ? `\nEl usuario está actualmente en el módulo: ${active_module}.`
      : "";

    const dataBlock = contextData
      ? `\n\nDATOS ACTUALES DEL NEGOCIO:\n${contextData}`
      : "";

    const systemPrompt = [
      `Tu nombre es ${assistantName}. Asistente de Bivoo (plataforma de gestión de negocios). Tono: ${tone}.`,
      `REGLA FUNDAMENTAL: Solo puedes responder sobre temas relacionados con Bivoo y la gestión del negocio del usuario. NO respondas preguntas de cultura general, historia, ciencia, matemáticas, programación, recetas, ni ningún tema ajeno a Bivoo. Si el usuario pregunta algo fuera del ámbito de Bivoo, responde: "Solo puedo ayudarte con temas relacionados a tu negocio en Bivoo. ¿En qué puedo ayudarte?"`,
      `RESTRICCIÓN DE CONOCIMIENTO: Tu conocimiento se limita ESTRICTAMENTE a:
1. Las instrucciones base configuradas por el administrador (abajo).
2. Las instrucciones específicas del módulo activo (si las hay).
3. Los ejemplos de entrenamiento proporcionados.
4. Los datos reales del negocio del usuario.
NO inventes funcionalidades, flujos ni opciones que no estén descritas en tus instrucciones. Si no tienes información sobre algo, di: "No tengo información sobre eso. Contacta al soporte de Bivoo."`,
      buildRoleBlock(role || "employee"),
      moduleInstructionsBlock,
      baseInstructions ? baseInstructions.slice(0, 1500) : "",
      moduleContext,
      trainingBlock,
      dataBlock,
      `SUGERENCIAS: Al final de CADA respuesta agrega exactamente: [SUGERENCIAS]pregunta1|pregunta2|pregunta3 — las sugerencias DEBEN ser relevantes al tema de la conversación actual o al módulo activo (${active_module || 'general'}). NO uses preguntas genéricas si se está hablando de un tema específico. Máximo 8 palabras por sugerencia, solo sobre Bivoo y el módulo actual. Responde en español, conciso. No inventes datos. Si no sabes algo sobre Bivoo, admítelo.`,
    ]
      .filter(Boolean)
      .join("\n");

    /* ── Build messages array for Groq (OpenAI-compatible) ── */
    // Truncate conversation to last 4 messages, each max 300 chars
    const recentMessages = messages.slice(-4).map((m: any) => ({
      role: m.role === "model" ? "assistant" : m.role,
      content: typeof m.content === "string" ? m.content.slice(0, 300) : String(m.content).slice(0, 300),
    }));
    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...recentMessages,
    ];

    /* ── Call Groq API ── */
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: groqMessages,
        stream: true,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq error:", groqRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Groq API error", details: errText }),
        {
          status: groqRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    /* ── Get user_id from auth header for DB writes ── */
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;
    if (token) {
      const anonClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const {
        data: { user },
      } = await anonClient.auth.getUser();
      userId = user?.id || null;
    }

    /* ── Stream Groq SSE directly (already OpenAI-compatible) ── */
    const reader = groqRes.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") {
                if (jsonStr === "[DONE]") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
                continue;
              }

              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed?.choices?.[0]?.delta?.content;
                if (text) {
                  fullResponse += text;
                }
                // Forward the SSE chunk as-is (already OpenAI-compatible)
                controller.enqueue(encoder.encode(`data: ${jsonStr}\n\n`));
              } catch {
                // skip malformed lines
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.error(err);
        }

        /* ── Fire-and-forget: save conversation & track usage ── */
        if (userId && business_id) {
          const allMessages = [
            ...messages,
            { role: "assistant", content: fullResponse },
          ];

          supabase
            .from("assistant_conversations")
            .upsert(
              {
                user_id: userId,
                business_id,
                user_role: role || "employee",
                messages: allMessages,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,business_id" }
            )
            .then(() => {});

          supabase
            .rpc("increment_feature_usage", {
              _business_id: business_id,
              _user_id: userId,
              _feature_key: "assistant_chat",
            })
            .then(() => {});
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("bivoo-assistant error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

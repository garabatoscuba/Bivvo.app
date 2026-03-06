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
      .limit(20);

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

    /* ── Build system prompt ── */
    const moduleContext = active_module
      ? `\nEl usuario está actualmente en el módulo: ${active_module}.`
      : "";

    const systemPrompt = [
      `Tu nombre es ${assistantName}. Eres un asistente inteligente de la plataforma Bivoo para gestión de negocios.`,
      `Tono: ${tone}.`,
      buildRoleBlock(role || "employee"),
      baseInstructions,
      moduleContext,
      trainingBlock,
      `Responde siempre en español, de forma concisa y útil. No inventes datos.`,
    ]
      .filter(Boolean)
      .join("\n");

    /* ── Build messages array for Groq (OpenAI-compatible) ── */
    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role === "model" ? "assistant" : m.role,
        content: m.content,
      })),
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

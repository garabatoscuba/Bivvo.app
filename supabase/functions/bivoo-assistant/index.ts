// v2 - gemini fix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROLE_RESTRICTIONS: Record<string, string> = {
  seller:
    "El usuario es vendedor/dependiente. Solo puedes responder sobre POS, Servicios y Caja. Si pregunta algo fuera de estos módulos, indica que no tiene acceso a esa función.",
  partner: "El usuario es Partner. Solo puedes responder sobre Mi Red. No reveles información de otros módulos.",
  manager:
    "El usuario es gerente. Puede preguntar sobre POS, Servicios, Caja, Inventario, Pedidos, Reportes, Empleados y Ventas. No tiene acceso a Planes, suscripciones ni configuración de negocio.",
  owner: "El usuario es dueño del negocio. Tiene acceso completo a todos los módulos.",
};

const TONE_MAP: Record<string, string> = {
  formal: "Responde siempre de forma profesional, estructurada y respetuosa. Evita coloquialismos.",
  friendly: "Responde de forma clara, cercana y amigable. Usa un tono conversacional pero profesional.",
  technical: "Responde con precisión técnica. Sé directo y específico. Usa terminología apropiada.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, role, active_module, business_id } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    console.log("GEMINI_API_KEY present:", !!Deno.env.get("GEMINI_API_KEY"));
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const [configRes, btInstrRes, trainingRes] = await Promise.all([
      sb.from("assistant_config").select("*").limit(1).single(),
      business_id
        ? sb
            .from("businesses")
            .select("business_type")
            .eq("id", business_id)
            .single()
            .then(async (bizRes) => {
              if (!bizRes.data?.business_type) return { data: null };
              return sb
                .from("assistant_business_type_instructions")
                .select("instructions")
                .eq("business_type", bizRes.data.business_type)
                .single();
            })
        : Promise.resolve({ data: null }),
      sb
        .from("assistant_training_examples")
        .select("question, answer")
        .eq("is_active", true)
        .order("sort_order")
        .limit(20),
    ]);

    const config = configRes.data;
    const btInstructions = (btInstrRes as any)?.data?.instructions || "";
    const trainingExamples = trainingRes.data || [];

    if (config && !config.is_enabled) {
      return new Response(JSON.stringify({ error: "El asistente está desactivado temporalmente." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roleInstructions = ROLE_RESTRICTIONS[role] || ROLE_RESTRICTIONS.owner;
    const toneInstruction = TONE_MAP[config?.tone || "friendly"] || TONE_MAP.friendly;

    let trainingSection = "";
    if (trainingExamples.length > 0) {
      trainingSection =
        "\n\nEJEMPLOS DE REFERENCIA:\n" +
        trainingExamples.map((e: any) => `Pregunta: ${e.question}\nRespuesta ideal: ${e.answer}`).join("\n\n");
    }

    const systemPrompt = `Eres el asistente virtual de Bivoo, una plataforma de gestión para negocios.

INSTRUCCIONES BASE:
- Ayudas a los usuarios a sacar el máximo provecho del sistema.
- Orienta según el módulo activo del usuario.
- ${toneInstruction}
- NUNCA reveles nombres de tablas, componentes, archivos, variables de entorno, URLs, credenciales ni la arquitectura técnica del sistema.
- Si no puedes resolver algo responde exactamente: "Para esto te recomiendo contactar al soporte de Bivoo."
- NUNCA ejecutes operaciones de dinero sin confirmación explícita del usuario.
- Si el usuario describe un problema, identifica qué parte del sistema lo resuelve y explica cómo llegar, sin ejecutar nada.

RESTRICCIONES DE ROL:
${roleInstructions}

CONTEXTO ACTUAL:
- Módulo activo: ${active_module || "General"}
- Rol del usuario: ${role || "viewer"}

CUSTOM_INSTRUCTIONS:
${config?.base_instructions || ""}
${btInstructions ? "\nINSTRUCCIONES DEL TIPO DE NEGOCIO:\n" + btInstructions : ""}
${trainingSection}`;

    // Formato nativo Gemini — roles: "user" y "model" (nunca "assistant")
    const geminiContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del asistente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transformar SSE de Gemini al formato OpenAI que espera AssistantPanel
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    (async () => {
      const reader = response.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6).trim();
            if (jsonStr === "[DONE]") {
              await writer.write(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const chunk = { choices: [{ delta: { content: text } }] };
                await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              }
            } catch {
              /* ignorar líneas malformadas */
            }
          }
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Stream error:", e);
      } finally {
        await writer.close();
      }
    })();

    // Guardar conversación fire-and-forget
    if (business_id && messages.length > 0) {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "");
      if (token) {
        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const {
          data: { user },
        } = await userClient.auth.getUser(token);
        if (user) {
          sb.from("assistant_conversations")
            .upsert(
              {
                business_id,
                user_id: user.id,
                user_role: role || "viewer",
                messages,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "business_id,user_id" },
            )
            .then(() => {
              /* silent */
            });
          sb.rpc("increment_feature_usage", {
            _business_id: business_id,
            _user_id: user.id,
            _feature_key: "assistant_chat",
          }).then(() => {
            /* silent */
          });
        }
      }
    }

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("bivoo-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

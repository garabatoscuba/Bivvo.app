import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROLE_RESTRICTIONS: Record<string, string> = {
  seller: "El usuario es vendedor/dependiente. Solo puedes responder sobre POS, Servicios y Caja.",
  partner: "El usuario es Partner. Solo puedes responder sobre Mi Red.",
  manager: "El usuario es gerente. Puede preguntar sobre POS, Servicios, Caja, Inventario, Pedidos, Reportes, Empleados y Ventas. No tiene acceso a Planes ni configuración de negocio.",
  owner: "El usuario es dueño del negocio. Tiene acceso completo a todos los módulos.",
};

const TONE_MAP: Record<string, string> = {
  formal: "Responde siempre de forma profesional, estructurada y respetuosa.",
  friendly: "Responde de forma clara, cercana y amigable.",
  technical: "Responde con precisión técnica. Sé directo y específico.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("VITE_GEMINI_API_KEY");
    console.log("GEMINI_API_KEY present:", !!GEMINI_API_KEY);
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const { messages, role, active_module, business_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const [configRes, btInstrRes, trainingRes] = await Promise.all([
      sb.from("assistant_config").select("*").limit(1).single(),
      business_id
        ? sb.from("businesses").select("business_type").eq("id", business_id).single()
            .then(async (bizRes) => {
              if (!bizRes.data?.business_type) return { data: null };
              return sb.from("assistant_business_type_instructions")
                .select("instructions").eq("business_type", bizRes.data.business_type).single();
            })
        : Promise.resolve({ data: null }),
      sb.from("assistant_training_examples").select("question, answer")
        .eq("is_active", true).order("sort_order").limit(20),
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
      trainingSection = "\n\nEJEMPLOS DE REFERENCIA:\n" +
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

RESTRICCIONES DE ROL:
${roleInstructions}

CONTEXTO ACTUAL:
- Módulo activo: ${active_module || "General"}
- Rol del usuario: ${role || "viewer"}

${config?.base_instructions ? "INSTRUCCIONES PERSONALIZADAS:\n" + config.base_instructions : ""}
${btInstructions ? "\nINSTRUCCIONES DEL TIPO DE NEGOCIO:\n" + btInstructions : ""}
${trainingSection}`;

    // Convert messages to Gemini format (role: user | model)
    const contents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    console.log("Calling Gemini streamGenerateContent, messages:", contents.length);

   const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 1000 },
      }),
    });

    console.log("Gemini response status:", response.status);

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Gemini error body:", errBody);
      return new Response(JSON.stringify({ error: "Error del asistente", detail: errBody }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream Gemini SSE → client
    // Gemini SSE chunks: data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
    // We transform to OpenAI-compatible SSE so the existing client parser works
    const encoder = new TextEncoder();
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) {
              // Re-emit as OpenAI-compatible SSE
              const openaiChunk = JSON.stringify({
                choices: [{ delta: { content } }],
              });
              controller.enqueue(encoder.encode(`data: ${openaiChunk}\n\n`));
            }
          } catch {
            // ignore parse errors
          }
        }
      },
      flush(controller) {
        controller.enqueue
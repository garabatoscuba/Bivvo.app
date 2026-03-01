import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROLE_RESTRICTIONS: Record<string, string> = {
  seller:
    "El usuario es vendedor/dependiente. Solo puedes responder sobre POS, Servicios y Caja. Si pregunta algo fuera de estos módulos, indica que no tiene acceso a esa función.",
  partner:
    "El usuario es Partner. Solo puedes responder sobre Mi Red. No reveles información de otros módulos.",
  manager:
    "El usuario es gerente. Puede preguntar sobre POS, Servicios, Caja, Inventario, Pedidos, Reportes, Empleados y Ventas. No tiene acceso a Planes, suscripciones ni configuración de negocio.",
  owner:
    "El usuario es dueño del negocio. Tiene acceso completo a todos los módulos.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, role, active_module, business_id } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const roleInstructions = ROLE_RESTRICTIONS[role] || ROLE_RESTRICTIONS.owner;

    const systemPrompt = `Eres el asistente virtual de Bivoo, una plataforma de gestión para negocios.

INSTRUCCIONES BASE:
- Ayudas a los usuarios a sacar el máximo provecho del sistema.
- Orienta según el módulo activo del usuario.
- Responde siempre en español de forma clara, concisa y amigable.
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
{/* Preparado para recibir datos externos en el futuro */}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Se agotaron los créditos de IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Error del asistente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("bivoo-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

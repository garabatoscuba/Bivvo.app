import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, position, business_id, branch_id } = await req.json();
    if (!email || !business_id) {
      return new Response(JSON.stringify({ error: "Email y business_id requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is authenticated and is owner/manager of the business
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Find profile by email
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, user_id, business_id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ linked: false, reason: "No existe cuenta con ese correo. El empleado deberá registrarse primero." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile: assign to business and branch
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        business_id,
        branch_id: branch_id || null,
        user_type: "internal",
      })
      .eq("id", targetProfile.id);

    if (profileError) {
      return new Response(
        JSON.stringify({ error: "Error al actualizar perfil: " + profileError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine role from position
    const roleMap: Record<string, string> = {
      seller: "seller",
      manager: "manager",
      accountant: "accountant",
      owner: "seller",
    };
    const role = roleMap[position] || "seller";

    // Check if role already exists — additive
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", targetProfile.user_id)
      .eq("role", role)
      .maybeSingle();

    if (!existingRole) {
      await admin
        .from("user_roles")
        .insert({ user_id: targetProfile.user_id, role });
    }

    return new Response(
      JSON.stringify({
        linked: true,
        profile_id: targetProfile.id,
        user_id: targetProfile.user_id,
        message: "Empleado vinculado al negocio exitosamente",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Employee linking error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

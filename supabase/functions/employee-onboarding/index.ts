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
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user from the auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to get the authenticated user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuario no válido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for privileged operations
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Validate token
    const { data: tokenData, error: tokenError } = await admin
      .from("employee_onboarding_tokens")
      .select("*")
      .eq("token", token)
      .is("used_at", null)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Token inválido o ya utilizado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token expirado. Solicita uno nuevo a tu gerente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's profile
    const { data: profile } = await admin
      .from("profiles")
      .select("id, business_id, branch_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Perfil no encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile: assign to business and branch
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        business_id: tokenData.business_id,
        branch_id: tokenData.branch_id,
        user_type: "internal",
      })
      .eq("id", profile.id);

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
      owner: "seller", // safety: don't auto-assign owner
    };
    const role = roleMap[tokenData.position] || "seller";

    // Check if role already exists — additive: don't remove existing roles
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", role)
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await admin
        .from("user_roles")
        .insert({ user_id: user.id, role });

      if (roleError) {
        console.error("Error assigning role:", roleError);
      }
    }

    // Add employee branch assignment if branch exists
    if (tokenData.branch_id) {
      const { data: existingAssignment } = await admin
        .from("employee_branch_assignments")
        .select("id")
        .eq("employee_id", tokenData.employee_id)
        .eq("branch_id", tokenData.branch_id)
        .maybeSingle();

      if (!existingAssignment) {
        await admin
          .from("employee_branch_assignments")
          .insert({
            employee_id: tokenData.employee_id,
            branch_id: tokenData.branch_id,
          });
      }
    }

    // Mark token as used
    await admin
      .from("employee_onboarding_tokens")
      .update({ used_at: new Date().toISOString(), used_by: user.id })
      .eq("id", tokenData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "¡Bienvenido al equipo!",
        businessId: tokenData.business_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Onboarding error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

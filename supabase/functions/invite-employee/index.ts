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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, business_id, branch_id, position, employee_id } = await req.json();
    if (!email || !business_id || !employee_id) {
      return new Response(
        JSON.stringify({ error: "email, business_id y employee_id son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const role = position || "seller";

    // Find existing user by email using listUsers (reliable, doesn't throw)
    let existingUserId: string | null = null;
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listData?.users) {
      const found = listData.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (found) existingUserId = found.id;
    }

    if (existingUserId) {
      // User already registered — link directly
      const { error: empErr } = await admin
        .from("employees")
        .update({ email, auth_user_id: existingUserId, position: role })
        .eq("id", employee_id);
      if (empErr) {
        return new Response(
          JSON.stringify({ error: empErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update profile with business/branch
      await admin
        .from("profiles")
        .update({ business_id, branch_id: branch_id || null })
        .eq("user_id", existingUserId);

      // Remove accidental owner role
      // Don't delete owner role for existing users — they may be legitimate owners

      // Sync role
      const { data: existingRole } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", existingUserId)
        .eq("role", role)
        .maybeSingle();
      if (!existingRole) {
        await admin.from("user_roles").insert({ user_id: existingUserId, role });
      }

      return new Response(
        JSON.stringify({ success: true, linked: true, user_id: existingUserId, message: "Usuario vinculado exitosamente" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User doesn't exist — send invitation
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { invited_to_business: business_id, invited_position: role },
    });

    if (inviteError) {
      // If the error is "already registered", try linking instead
      if (inviteError.message?.includes("already been registered")) {
        // Race condition: user was created between our check and invite
        // Try getUserByEmail one more time
        // Race condition: user was created between our check and invite — find via listUsers
        const { data: retryList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const retryUser = retryList?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        if (retryUser) {
            await admin
              .from("employees")
              .update({ email, auth_user_id: retryUser.id, position: role })
              .eq("id", employee_id);

            await admin
              .from("profiles")
              .update({ business_id, branch_id: branch_id || null })
              .eq("user_id", retryUser.id);

            const { data: er } = await admin.from("user_roles").select("id").eq("user_id", retryUser.id).eq("role", role).maybeSingle();
            if (!er) await admin.from("user_roles").insert({ user_id: retryUser.id, role });

            return new Response(
              JSON.stringify({ success: true, linked: true, user_id: retryUser.id, message: "Usuario vinculado exitosamente" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
      }

      return new Response(
        JSON.stringify({ error: inviteError.message || "Error al enviar invitación" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!inviteData?.user) {
      return new Response(
        JSON.stringify({ error: "No se pudo crear la invitación" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = inviteData.user.id;

    // Wait for trigger to create profile
    await new Promise((r) => setTimeout(r, 1500));

    // Update employee record with invited user
    await admin
      .from("employees")
      .update({ email, auth_user_id: userId, position: role })
      .eq("id", employee_id);

    // Update profile with business/branch
    await admin
      .from("profiles")
      .update({ business_id, branch_id: branch_id || null })
      .eq("user_id", userId);

    // Remove accidental owner role from signup trigger
    await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "owner");

    // Assign role
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", role)
      .maybeSingle();
    if (!existingRole) {
      await admin.from("user_roles").insert({ user_id: userId, role });
    }

    return new Response(
      JSON.stringify({
        success: true,
        invited: true,
        user_id: userId,
        message: `Invitación enviada a ${email}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Invite employee error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

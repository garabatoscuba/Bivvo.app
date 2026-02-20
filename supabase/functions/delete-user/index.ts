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
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await supabaseAuth.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check caller is super_admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Se requiere rol de super administrador" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, action } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id es requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "No puedes eliminarte a ti mismo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SOFT DELETE: schedule deletion in 30 days
    if (action === 'schedule_deletion') {
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 30);
      
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          deleted_at: new Date().toISOString(),
          deletion_scheduled_at: deletionDate.toISOString(),
        })
        .eq("user_id", user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, action: 'scheduled' }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REVERT: cancel pending deletion
    if (action === 'revert_deletion') {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          deleted_at: null,
          deletion_scheduled_at: null,
        })
        .eq("user_id", user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, action: 'reverted' }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // HARD DELETE: permanent removal (used after 30 days or forced)
    // 1. Delete user_roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);

    // 2. Delete profile
    await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);

    // 3. Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: `Error al eliminar usuario: ${deleteError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, action: 'deleted' }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

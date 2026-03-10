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

    const body = await req.json();
    const { action } = body;

    // ── BULK ACTIONS ──
    if (action === 'bulk_ban' || action === 'bulk_delete') {
      const { user_ids } = body;
      if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return new Response(JSON.stringify({ error: "user_ids es requerido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Filter out caller
      const safeIds = user_ids.filter((id: string) => id !== caller.id);
      // Filter out other super_admins
      const { data: superAdmins } = await supabaseAdmin
        .from("user_roles").select("user_id").eq("role", "super_admin");
      const superAdminIds = new Set((superAdmins || []).map(r => r.user_id));
      const targetIds = safeIds.filter((id: string) => !superAdminIds.has(id));

      let success = 0;
      let failed = 0;

      for (const uid of targetIds) {
        try {
          if (action === 'bulk_ban') {
            const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, {
              ban_duration: '876000h', // ~100 years
            });
            if (error) { failed++; continue; }
          } else {
            // bulk_delete: hard delete
            await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
            await supabaseAdmin.from("profiles").delete().eq("user_id", uid);
            const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
            if (error) { failed++; continue; }
          }
          success++;
        } catch {
          failed++;
        }
      }

      const skipped = user_ids.length - targetIds.length;
      return new Response(JSON.stringify({ success: true, action, count: success, failed, skipped }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'bulk_unban') {
      const { user_ids } = body;
      if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return new Response(JSON.stringify({ error: "user_ids es requerido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let success = 0;
      let failed = 0;
      for (const uid of user_ids) {
        try {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, {
            ban_duration: 'none',
          });
          if (error) { failed++; continue; }
          success++;
        } catch {
          failed++;
        }
      }
      return new Response(JSON.stringify({ success: true, action: 'bulk_unban', count: success, failed }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SINGLE USER ACTIONS ──
    const { user_id } = body;
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id es requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "No puedes realizar esta acción sobre ti mismo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // BAN USER
    if (action === 'ban_user') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        ban_duration: '876000h',
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, action: 'banned' }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UNBAN USER
    if (action === 'unban_user') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        ban_duration: 'none',
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, action: 'unbanned' }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // HARD DELETE: permanent removal
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);
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

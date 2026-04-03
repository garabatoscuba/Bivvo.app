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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is owner or super_admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const roles = (callerRoles || []).map((r: any) => r.role);
    if (!roles.includes("owner") && !roles.includes("super_admin")) {
      return new Response(JSON.stringify({ error: "Sin permisos para eliminar empleados" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { employee_id } = await req.json();
    if (!employee_id) {
      return new Response(JSON.stringify({ error: "employee_id es requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get employee info
    const { data: employee, error: empError } = await admin
      .from("employees")
      .select("id, full_name, auth_user_id, email, business_id")
      .eq("id", employee_id)
      .maybeSingle();

    if (empError || !employee) {
      return new Response(JSON.stringify({ error: "Empleado no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If owner (not super_admin), verify they own this business
    if (!roles.includes("super_admin")) {
      const { data: callerProfile } = await admin
        .from("profiles")
        .select("business_id")
        .eq("user_id", caller.id)
        .maybeSingle();
      if (!callerProfile || callerProfile.business_id !== employee.business_id) {
        return new Response(JSON.stringify({ error: "No tienes acceso a este empleado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const authUserId = employee.auth_user_id;

    // Clean up related data
    await admin.from("employee_salary_assignments").delete().eq("employee_id", employee_id);
    await admin.from("employee_branch_assignments").delete().eq("employee_id", employee_id);
    await admin.from("employee_insumo_areas").delete().eq("employee_id", employee_id);
    await admin.from("employee_material_stock").delete().eq("employee_id", employee_id);
    await admin.from("employee_evaluations").delete().eq("employee_id", employee_id);
    await admin.from("employee_onboarding_tokens").delete().eq("employee_id", employee_id);
    await admin.from("employee_salary_deductions").delete().eq("employee_id", employee_id);

    // Delete the employee row
    const { error: deleteEmpError } = await admin.from("employees").delete().eq("id", employee_id);
    if (deleteEmpError) {
      return new Response(JSON.stringify({ error: deleteEmpError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If linked to an auth user (@bivoo.app), clean up auth
    if (authUserId) {
      await admin.from("user_roles").delete().eq("user_id", authUserId);
      await admin.from("profiles").delete().eq("user_id", authUserId);
      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(authUserId);
      if (deleteAuthError) {
        console.error("Warning: could not delete auth user:", deleteAuthError.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Empleado ${employee.full_name} eliminado completamente` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Delete bivoo employee error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

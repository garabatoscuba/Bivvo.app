import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.-]/g, "")
    .replace(/\s+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

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

    const { full_name, password, business_id, branch_id, position, employee_id } = await req.json();
    if (!full_name || !password || !business_id || !employee_id) {
      return new Response(
        JSON.stringify({ error: "full_name, password, business_id y employee_id son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Generate unique @bivoo.app email
    const baseSlug = slugify(full_name);
    let email = `${baseSlug}@bivoo.app`;
    let attempt = 0;

    // Check uniqueness
    while (true) {
      const { data: existing } = await admin.auth.admin.listUsers();
      const taken = existing?.users?.some((u: any) => u.email === email);
      if (!taken) break;
      attempt++;
      email = `${baseSlug}${attempt}@bivoo.app`;
      if (attempt > 20) {
        return new Response(
          JSON.stringify({ error: "No se pudo generar un identificador único" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create user with auto-confirm (no email verification needed)
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !newUser?.user) {
      return new Response(
        JSON.stringify({ error: createError?.message || "Error al crear usuario" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;

    // Wait for the trigger to create the profile, then update it
    // The handle_new_user trigger creates a profile automatically
    // We need to wait a moment for it to execute
    await new Promise((r) => setTimeout(r, 1500));

    const normalizedPosition = (() => {
      const raw = String(position || "").toLowerCase().trim();
      if (["manager", "gerente"].includes(raw)) return "manager";
      if (["accountant", "contable"].includes(raw)) return "accountant";
      if (["seller", "vendedor", "dependiente", "dependent"].includes(raw)) return "seller";
      return "seller";
    })();

    // Update the employee record with generated credentials binding
    const { error: employeeUpdateError } = await admin
      .from("employees")
      .update({ email, auth_user_id: userId, position: normalizedPosition })
      .eq("id", employee_id);

    if (employeeUpdateError) {
      return new Response(
        JSON.stringify({ error: employeeUpdateError.message || "No se pudo vincular la cuenta al empleado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove accidental owner role created by signup trigger for internal @bivoo users
    await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "owner");

    // Assign the appropriate operational role
    const role = normalizedPosition;

    // Check if role already exists
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
        email,
        user_id: userId,
        message: `Cuenta ${email} creada exitosamente`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Create bivoo employee error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

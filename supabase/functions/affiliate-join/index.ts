import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user's JWT
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { branch_id } = await req.json();
    if (!branch_id) {
      return new Response(JSON.stringify({ error: "branch_id requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for DB operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get business_id from branch
    const { data: branch, error: branchErr } = await supabase
      .from("branches")
      .select("id, business_id")
      .eq("id", branch_id)
      .single();

    if (branchErr || !branch) {
      return new Response(JSON.stringify({ error: "Sucursal no encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if affiliation already exists
    const { data: existing } = await supabase
      .from("affiliations")
      .select("id, points")
      .eq("user_id", user.id)
      .eq("branch_id", branch_id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, affiliation: existing, already_existed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create affiliation
    const { data: affiliation, error: affErr } = await supabase
      .from("affiliations")
      .insert({
        user_id: user.id,
        branch_id: branch_id,
        business_id: branch.business_id,
        points: 10, // Welcome bonus
      })
      .select("id, points")
      .single();

    if (affErr) {
      return new Response(JSON.stringify({ error: affErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure profile is marked as affiliated (for new signups this might already be set)
    await supabase
      .from("profiles")
      .update({ user_type: "affiliated" })
      .eq("user_id", user.id)
      .eq("user_type", "internal")
      .is("business_id", null); // Only update if they don't own a business — safety check removed, we use a softer check

    // Ensure user has affiliated role
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "affiliated")
      .maybeSingle();

    if (!existingRole) {
      await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: "affiliated" });
    }

    return new Response(JSON.stringify({ success: true, affiliation, already_existed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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

    const body = await req.json();
    const { branch_id, action } = body;
    if (!branch_id) {
      return new Response(JSON.stringify({ error: "branch_id requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // Fetch loyalty config for this business
    const { data: loyaltyConfig } = await supabase
      .from("loyalty_config")
      .select("*")
      .eq("business_id", branch.business_id)
      .maybeSingle();

    const ptsWelcome = loyaltyConfig?.points_welcome ?? 10;
    const ptsName = loyaltyConfig?.points_name ?? 10;
    const ptsPhone = loyaltyConfig?.points_phone ?? 10;
    const ptsEmail = loyaltyConfig?.points_email ?? 10;

    // Handle profile field update for points
    if (action === "update_fields") {
      const { name, phone, email } = body;
      const { data: existing } = await supabase
        .from("affiliations")
        .select("id, points, name_completed, phone_completed, email_completed")
        .eq("user_id", user.id)
        .eq("branch_id", branch_id)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ error: "No afiliado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let extraPoints = 0;
      const updates: Record<string, any> = {};

      if (name?.trim() && !existing.name_completed) {
        extraPoints += ptsName;
        updates.name_completed = true;
      }
      if (phone?.trim() && !existing.phone_completed) {
        extraPoints += ptsPhone;
        updates.phone_completed = true;
      }
      if (email?.trim() && !existing.email_completed) {
        extraPoints += ptsEmail;
        updates.email_completed = true;
      }

      if (extraPoints > 0) {
        updates.points = existing.points + extraPoints;
        await supabase
          .from("affiliations")
          .update(updates)
          .eq("id", existing.id);
      }

      // Update profile fields if provided
      const profileUpdates: Record<string, any> = {};
      if (name?.trim()) profileUpdates.full_name = name.trim();
      if (phone?.trim()) profileUpdates.phone = phone.trim();
      if (Object.keys(profileUpdates).length > 0) {
        await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("user_id", user.id);
      }

      return new Response(JSON.stringify({
        success: true,
        points_earned: extraPoints,
        total_points: (existing.points || 0) + extraPoints,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default action: join
    const { data: existing } = await supabase
      .from("affiliations")
      .select("id, points, name_completed, phone_completed, email_completed")
      .eq("user_id", user.id)
      .eq("branch_id", branch_id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, affiliation: existing, already_existed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if profile has name/phone/email already filled
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("user_id", user.id)
      .single();

    let initialPoints = ptsWelcome;
    const nameCompleted = !!(profile?.full_name && profile.full_name !== profile.email?.split('@')[0]);
    const phoneCompleted = !!profile?.phone;
    const emailCompleted = !!profile?.email;

    if (nameCompleted) initialPoints += ptsName;
    if (phoneCompleted) initialPoints += ptsPhone;
    if (emailCompleted) initialPoints += ptsEmail;

    const { data: affiliation, error: affErr } = await supabase
      .from("affiliations")
      .insert({
        user_id: user.id,
        branch_id: branch_id,
        business_id: branch.business_id,
        points: initialPoints,
        name_completed: nameCompleted,
        phone_completed: phoneCompleted,
        email_completed: emailCompleted,
      })
      .select("id, points, name_completed, phone_completed, email_completed")
      .single();

    if (affErr) {
      return new Response(JSON.stringify({ error: affErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure profile is marked as affiliated
    await supabase
      .from("profiles")
      .update({ user_type: "affiliated" })
      .eq("user_id", user.id)
      .eq("user_type", "internal")
      .is("business_id", null);

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

    return new Response(JSON.stringify({
      success: true,
      affiliation,
      already_existed: false,
      loyalty_config: { points_welcome: ptsWelcome, points_name: ptsName, points_phone: ptsPhone, points_email: ptsEmail },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;
    const { business_name, business_type, base_currency, country } = await req.json();

    if (!business_name || typeof business_name !== "string" || !business_name.trim()) {
      return new Response(JSON.stringify({ error: "business_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get profile
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, business_id")
      .eq("user_id", userId)
      .single();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile
    const { error: profileUpdateErr } = await admin
      .from("profiles")
      .update({
        country: country || null,
        onboarding_completed: true,
      })
      .eq("user_id", userId);

    if (profileUpdateErr) {
      return new Response(JSON.stringify({ error: profileUpdateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update business if exists
    if (profile.business_id) {
      const validTypes = ["store", "copy_shop", "gym"];
      const bizType = validTypes.includes(business_type) ? business_type : "store";

      const { error: bizErr } = await admin
        .from("businesses")
        .update({
          name: business_name.trim(),
          business_type: bizType,
          base_currency: base_currency || "USD",
        })
        .eq("id", profile.business_id);

      if (bizErr) {
        return new Response(JSON.stringify({ error: bizErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create default "Uso Interno" insumo area if it doesn't exist
      const { data: existingArea } = await admin
        .from("insumo_areas")
        .select("id")
        .eq("business_id", profile.business_id)
        .eq("is_internal", true)
        .maybeSingle();

      if (!existingArea) {
        await admin.from("insumo_areas").insert({
          business_id: profile.business_id,
          name: "Uso Interno",
          icon: "Home",
          color: "primary",
          is_internal: true,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

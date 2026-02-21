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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is super_admin
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await anonClient.auth.getClaims(token);
    const callerId = claims?.claims?.sub as string;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isSA } = await admin.rpc("is_super_admin", { _user_id: callerId });
    if (!isSA) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { request_id, action } = await req.json();
    if (!request_id || !["approved", "rejected"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the request
    const { data: request, error: reqErr } = await admin
      .from("business_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (request.status !== "pending") {
      return new Response(JSON.stringify({ error: "Request already processed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get requester profile
    const { data: profile } = await admin
      .from("profiles")
      .select("id, business_id, full_name")
      .eq("user_id", request.user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "rejected") {
      await admin.from("business_requests").update({
        status: "rejected",
        approved_by: callerId,
        approved_at: new Date().toISOString(),
      }).eq("id", request_id);

      // Notify user of rejection
      if (profile.business_id) {
        await admin.from("notifications").insert({
          business_id: profile.business_id,
          user_id: request.user_id,
          type: "business_request_rejected",
          title: "Solicitud rechazada",
          message: `Tu solicitud para ${request.request_type === "business" ? "nuevo negocio" : "nueva sucursal"} "${request.business_name || request.branch_name}" fue rechazada. Contacta al administrador para más información.`,
          metadata: { request_id },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // APPROVED - actually create the business or branch
    if (request.request_type === "business") {
      // Create business
      const { data: biz, error: bizErr } = await admin
        .from("businesses")
        .insert({
          name: request.business_name,
          owner_id: profile.id,
          business_type: request.business_type || "store",
        })
        .select()
        .single();

      if (bizErr) {
        return new Response(JSON.stringify({ error: bizErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create main branch
      const { data: branch, error: branchErr } = await admin
        .from("branches")
        .insert({ business_id: biz.id, name: "Principal", is_main: true })
        .select()
        .single();

      if (branchErr) {
        await admin.from("businesses").delete().eq("id", biz.id);
        return new Response(JSON.stringify({ error: branchErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // DO NOT update user's profile business_id - they keep their current business
      // The new business is just created and owned by them

      // Notify user
      if (profile.business_id) {
        await admin.from("notifications").insert({
          business_id: profile.business_id,
          user_id: request.user_id,
          type: "business_request_approved",
          title: "¡Negocio aprobado!",
          message: `Tu nuevo negocio "${biz.name}" ha sido aprobado y está listo. Puedes acceder desde el menú de Negocios.`,
          metadata: { request_id, business_id: biz.id },
        });
      }
    } else if (request.request_type === "branch") {
      // Create branch
      const { data: branch, error: branchErr } = await admin
        .from("branches")
        .insert({
          business_id: request.branch_business_id,
          name: request.branch_name,
        })
        .select()
        .single();

      if (branchErr) {
        return new Response(JSON.stringify({ error: branchErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Notify user
      if (profile.business_id) {
        await admin.from("notifications").insert({
          business_id: profile.business_id,
          user_id: request.user_id,
          type: "business_request_approved",
          title: "¡Sucursal aprobada!",
          message: `Tu nueva sucursal "${branch.name}" ha sido aprobada y está lista.`,
          metadata: { request_id, branch_id: branch.id },
        });
      }
    }

    // Mark request as approved
    await admin.from("business_requests").update({
      status: "approved",
      approved_by: callerId,
      approved_at: new Date().toISOString(),
    }).eq("id", request_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


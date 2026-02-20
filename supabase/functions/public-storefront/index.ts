import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const bizSlug = url.searchParams.get("biz");
    const branchSlug = url.searchParams.get("branch");

    if (!bizSlug || !branchSlug) {
      return new Response(JSON.stringify({ error: "Missing biz or branch slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch business
    const { data: business, error: bizErr } = await supabase
      .from("businesses")
      .select("id, name, slug, logo_url")
      .eq("slug", bizSlug)
      .single();

    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: "Negocio no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch branch
    const { data: branch, error: branchErr } = await supabase
      .from("branches")
      .select("id, name, slug, address, phone")
      .eq("business_id", business.id)
      .eq("slug", branchSlug)
      .single();

    if (branchErr || !branch) {
      return new Response(JSON.stringify({ error: "Sucursal no encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch store settings
    const { data: settings } = await supabase
      .from("store_settings")
      .select("is_active, has_delivery, schedule")
      .eq("branch_id", branch.id)
      .maybeSingle();

    if (!settings?.is_active) {
      return new Response(JSON.stringify({ error: "Tienda no disponible" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch products for sale with stock > 0 in this branch
    const { data: stockItems } = await supabase
      .from("branch_stock")
      .select("quantity, product:products(id, name, description, sale_price, image_url, code, category:categories(name, color))")
      .eq("branch_id", branch.id)
      .gt("quantity", 0);

    // Filter only for_sale products
    const products = (stockItems || [])
      .filter((s: any) => s.product && s.product.status !== "discontinued" && s.product.status !== "warehouse")
      .map((s: any) => ({
        id: s.product.id,
        name: s.product.name,
        description: s.product.description,
        price: s.product.sale_price,
        image_url: s.product.image_url,
        code: s.product.code,
        category: s.product.category?.name || null,
        category_color: s.product.category?.color || null,
        stock: s.quantity,
      }));

    return new Response(
      JSON.stringify({
        business: { name: business.name, logo_url: business.logo_url },
        branch: { name: branch.name, address: branch.address, phone: branch.phone },
        settings: { has_delivery: settings.has_delivery, schedule: settings.schedule },
        products,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

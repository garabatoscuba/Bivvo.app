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
    const url = new URL(req.url);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle POST actions
    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body;

      if (action === "register_affiliate") {
        const { branch_id, name, phone, email } = body;
        if (!branch_id) {
          return new Response(JSON.stringify({ error: "branch_id requerido" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        let points = 0;
        if (name?.trim()) points += 10;
        if (phone?.trim()) points += 10;
        if (email?.trim()) points += 10;

        const { data, error } = await supabase
          .from("affiliates")
          .insert({ branch_id, name: name?.trim() || null, phone: phone?.trim() || null, email: email?.trim() || null, points })
          .select("id, points")
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true, affiliate: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "submit_review") {
        const { branch_id, affiliate_id, rating, comment } = body;
        if (!branch_id || !affiliate_id || !rating) {
          return new Response(JSON.stringify({ error: "Datos incompletos" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: affiliate } = await supabase
          .from("affiliates").select("id").eq("id", affiliate_id).eq("branch_id", branch_id).single();
        if (!affiliate) {
          return new Response(JSON.stringify({ error: "Afiliado no encontrado" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabase.from("reviews").insert({
          branch_id, affiliate_id, rating: Math.min(5, Math.max(1, rating)), comment: comment?.trim() || null,
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Acción no válida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: Fetch storefront data
    const bizSlug = url.searchParams.get("biz");
    const branchSlug = url.searchParams.get("branch");

    if (!bizSlug || !branchSlug) {
      return new Response(JSON.stringify({ error: "Missing biz or branch slug" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: business, error: bizErr } = await supabase
      .from("businesses").select("id, name, slug, logo_url").eq("slug", bizSlug).single();
    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: "Negocio no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: branch, error: branchErr } = await supabase
      .from("branches").select("id, name, slug, address, phone").eq("business_id", business.id).eq("slug", branchSlug).single();
    if (branchErr || !branch) {
      return new Response(JSON.stringify({ error: "Sucursal no encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("store_settings")
      .select("is_active, has_delivery, schedule, accent_color, about_text, hero_image_url, hero_title, hero_subtitle, font_heading, font_body, social_instagram, social_facebook, social_tiktok, social_twitter")
      .eq("branch_id", branch.id)
      .maybeSingle();

    if (!settings?.is_active) {
      return new Response(JSON.stringify({ error: "Tienda no disponible" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: stockItems } = await supabase
      .from("branch_stock")
      .select("quantity, product:products(id, name, description, sale_price, image_url, code, category:categories(name, color))")
      .eq("branch_id", branch.id)
      .gt("quantity", 0);

    const products = (stockItems || [])
      .filter((s: any) => s.product && s.product.status !== "discontinued" && s.product.status !== "warehouse")
      .map((s: any) => ({
        id: s.product.id, name: s.product.name, description: s.product.description,
        price: s.product.sale_price, image_url: s.product.image_url, code: s.product.code,
        category: s.product.category?.name || null, category_color: s.product.category?.color || null, stock: s.quantity,
      }));

    const { data: reviews } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at, is_visible, affiliate:affiliates(name)")
      .eq("branch_id", branch.id).eq("is_visible", true)
      .order("created_at", { ascending: false }).limit(50);

    const { data: announcements } = await supabase
      .from("announcements")
      .select("id, title, description, badge_text")
      .eq("branch_id", branch.id).eq("is_active", true)
      .order("created_at", { ascending: false }).limit(10);

    return new Response(
      JSON.stringify({
        business: { name: business.name, logo_url: business.logo_url },
        branch: { id: branch.id, name: branch.name, address: branch.address, phone: branch.phone },
        settings: {
          has_delivery: settings.has_delivery,
          schedule: settings.schedule,
          accent_color: settings.accent_color,
          about_text: settings.about_text,
          hero_image_url: settings.hero_image_url || null,
          hero_title: settings.hero_title || null,
          hero_subtitle: settings.hero_subtitle || null,
          font_heading: settings.font_heading || 'Lora',
          font_body: settings.font_body || 'Work Sans',
          social_instagram: settings.social_instagram,
          social_facebook: settings.social_facebook,
          social_tiktok: settings.social_tiktok,
          social_twitter: settings.social_twitter,
        },
        products,
        reviews: (reviews || []).map((r: any) => ({
          id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at,
          author: r.affiliate?.name || 'Anónimo',
        })),
        announcements: announcements || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

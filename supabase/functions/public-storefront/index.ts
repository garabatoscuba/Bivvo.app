import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Cache-Control": "public, max-age=60, s-maxage=120",
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

        // Get business_id and loyalty config
        const { data: branch } = await supabase
          .from("branches").select("business_id").eq("id", branch_id).single();
        if (!branch) {
          return new Response(JSON.stringify({ error: "Sucursal no encontrada" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: loyaltyConfig } = await supabase
          .from("loyalty_config").select("*").eq("business_id", branch.business_id).maybeSingle();

        const ptsWelcome = loyaltyConfig?.points_welcome ?? 10;
        const ptsName = loyaltyConfig?.points_name ?? 10;
        const ptsPhone = loyaltyConfig?.points_phone ?? 10;
        const ptsEmail = loyaltyConfig?.points_email ?? 10;

        let points = ptsWelcome;
        if (name?.trim()) points += ptsName;
        if (phone?.trim()) points += ptsPhone;
        if (email?.trim()) points += ptsEmail;

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
        const { branch_id, affiliate_id, rating, comment, token } = body;
        
        // Support review via token (from delivery review request)
        if (token) {
          const { data: reviewToken } = await supabase
            .from("review_tokens")
            .select("id, branch_id, customer_name, used_at")
            .eq("token", token)
            .maybeSingle();

          if (!reviewToken || reviewToken.used_at) {
            return new Response(JSON.stringify({ error: "Token inválido o ya utilizado" }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Create a temporary affiliate for the review
          const { data: tempAffiliate } = await supabase
            .from("affiliates")
            .insert({ branch_id: reviewToken.branch_id, name: reviewToken.customer_name })
            .select("id")
            .single();

          if (tempAffiliate) {
            await supabase.from("reviews").insert({
              branch_id: reviewToken.branch_id,
              affiliate_id: tempAffiliate.id,
              rating: Math.min(5, Math.max(1, rating)),
              comment: comment?.trim() || null,
            });
            await supabase.from("review_tokens").update({ used_at: new Date().toISOString() }).eq("id", reviewToken.id);
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

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

      if (action === "send_contact") {
        const { branch_id, name, email, message } = body;
        if (!branch_id || !name?.trim() || !email?.trim() || !message?.trim()) {
          return new Response(JSON.stringify({ error: "Datos incompletos" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: storeSettings } = await supabase
          .from("store_settings").select("contact_email").eq("branch_id", branch_id).maybeSingle();
        if (!storeSettings?.contact_email) {
          return new Response(JSON.stringify({ error: "No hay correo de contacto configurado" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: branchData } = await supabase
          .from("branches").select("business_id").eq("id", branch_id).single();
        if (branchData) {
          await supabase.from("notifications").insert({
            business_id: branchData.business_id,
            branch_id,
            type: "contact_message",
            title: `Mensaje de ${name.trim()}`,
            message: `${email.trim()}: ${message.trim().substring(0, 500)}`,
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "submit_order") {
        const { branch_id, customer_name, customer_phone, delivery_address, notes, items, subtotal } = body;
        if (!branch_id || !customer_name?.trim() || !customer_phone?.trim() || !items?.length) {
          return new Response(JSON.stringify({ error: "Datos incompletos" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: branchData } = await supabase
          .from("branches").select("business_id, name").eq("id", branch_id).single();
        if (!branchData) {
          return new Response(JSON.stringify({ error: "Sucursal no encontrada" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Deduct stock for each item
        for (const item of items) {
          const { data: stockData } = await supabase
            .from("branch_stock")
            .select("quantity")
            .eq("branch_id", branch_id)
            .eq("product_id", item.product_id)
            .single();

          if (stockData) {
            const newQty = Math.max(0, stockData.quantity - item.quantity);
            await supabase
              .from("branch_stock")
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq("branch_id", branch_id)
              .eq("product_id", item.product_id);
          }
        }

        // Get currency symbol
        const { data: bizData } = await supabase.from("businesses").select("base_currency").eq("id", branchData.business_id).single();
        const cur = bizData?.base_currency || 'USD';
        const sym = cur === 'CUP' ? '$' : '$';

        const itemLines = items.map((i: any) => `• ${i.quantity}x ${i.product_name} — ${sym} ${Number(i.total).toFixed(2)}`).join("\n");
        const deliveryLine = delivery_address ? `\n📍 Dirección: ${delivery_address}` : "\n🏪 Retiro en tienda";
        const notesLine = notes ? `\n📝 Notas: ${notes}` : "";

        const message = `Pedido de ${customer_name.trim()} (${customer_phone.trim()}):\n${itemLines}\n\n💰 Total: ${sym} ${Number(subtotal).toFixed(2)}${deliveryLine}${notesLine}`;

        await supabase.from("notifications").insert({
          business_id: branchData.business_id,
          branch_id,
          type: "storefront_order",
          title: `Nuevo pedido de ${customer_name.trim()}`,
          message: message.substring(0, 1000),
          metadata: {
            customer_name: customer_name.trim(),
            customer_phone: customer_phone.trim(),
            delivery_address: delivery_address || null,
            notes: notes || null,
            items,
            subtotal,
            status: "new",
          },
        });

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

    if (!bizSlug) {
      return new Response(JSON.stringify({ error: "Missing biz slug" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: business, error: bizErr } = await supabase
      .from("businesses").select("id, name, slug, logo_url, base_currency").eq("slug", bizSlug).single();
    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: "Negocio no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let branchQuery = supabase
      .from("branches").select("id, name, slug, address, phone").eq("business_id", business.id);
    if (branchSlug) {
      branchQuery = branchQuery.eq("slug", branchSlug);
    } else {
      branchQuery = branchQuery.eq("is_main", true);
    }
    const { data: branch } = await branchQuery.maybeSingle();
    let resolvedBranch = branch;
    if (!resolvedBranch) {
      const { data: anyBranch } = await supabase
        .from("branches").select("id, name, slug, address, phone").eq("business_id", business.id).limit(1).single();
      if (!anyBranch) {
        return new Response(JSON.stringify({ error: "Sucursal no encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      resolvedBranch = anyBranch;
    }

    const [settingsResult, stockResult, reviewsResult, announcementsResult, loyaltyResult, rewardsResult, promoBlocksResult] = await Promise.all([
      supabase
        .from("store_settings")
        .select("is_active, has_delivery, schedule, accent_color, about_text, hero_image_url, hero_title, hero_subtitle, font_heading, font_body, social_instagram, social_facebook, social_tiktok, social_twitter, contact_email")
        .eq("branch_id", resolvedBranch.id)
        .maybeSingle(),
      supabase
        .from("branch_stock")
        .select("quantity, product:products(id, name, description, sale_price, image_url, code, status, category:categories(name, color))")
        .eq("branch_id", resolvedBranch.id)
        .gt("quantity", 0),
      supabase
        .from("reviews")
        .select("id, rating, comment, created_at, is_visible, affiliate:affiliates(name)")
        .eq("branch_id", resolvedBranch.id).eq("is_visible", true)
        .order("created_at", { ascending: false }).limit(50),
      supabase
        .from("announcements")
        .select("id, title, description, badge_text")
        .eq("branch_id", resolvedBranch.id).eq("is_active", true)
        .order("created_at", { ascending: false }).limit(10),
      supabase
        .from("loyalty_config")
        .select("points_welcome, points_name, points_phone, points_email")
        .eq("business_id", business.id)
        .maybeSingle(),
      supabase
        .from("rewards")
        .select("id, name, description, points_cost, reward_type, config")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    const settings = settingsResult.data;
    if (!settings?.is_active) {
      return new Response(JSON.stringify({ error: "Tienda no disponible" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const products = (stockResult.data || [])
      .filter((s: any) => s.product && s.product.status !== "discontinued" && s.product.status !== "warehouse")
      .map((s: any) => ({
        id: s.product.id, name: s.product.name, description: s.product.description,
        price: s.product.sale_price, image_url: s.product.image_url, code: s.product.code,
        category: s.product.category?.name || null, category_color: s.product.category?.color || null, stock: s.quantity,
      }));

    return new Response(
      JSON.stringify({
        business: { name: business.name, logo_url: business.logo_url },
        branch: { id: resolvedBranch.id, name: resolvedBranch.name, address: resolvedBranch.address, phone: resolvedBranch.phone },
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
          contact_email: settings.contact_email || null,
          currency: business.base_currency || 'USD',
        },
        products,
        reviews: (reviewsResult.data || []).map((r: any) => ({
          id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at,
          author: r.affiliate?.name || 'Anónimo',
        })),
        announcements: announcementsResult.data || [],
        loyalty: loyaltyResult.data || { points_welcome: 10, points_name: 10, points_phone: 10, points_email: 10 },
        rewards: rewardsResult.data || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

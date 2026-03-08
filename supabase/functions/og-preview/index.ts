import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_PATTERNS = /WhatsApp|facebookexternalhit|Twitterbot|TelegramBot|LinkedInBot|Googlebot|bot|crawler|spider|preview/i;

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatPrice(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2);
}

function buildOgHtml(opts: {
  title: string;
  ogTitle: string;
  description: string;
  imageUrl: string;
  url: string;
  siteName: string;
}): string {
  const { title, ogTitle, description, imageUrl, url, siteName } = opts;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="${escapeHtml(siteName)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
</head>
<body>
  <script>window.location.href = "${url.replace(/"/g, '\\"')}";</script>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const reqUrl = new URL(req.url);
    const params = reqUrl.searchParams;
    const bizSlug = params.get("biz");
    const branchSlug = params.get("branch");
    const productoId = params.get("producto");
    const originalUrl = params.get("url") || reqUrl.toString();

    // Check User-Agent
    const userAgent = req.headers.get("user-agent") || "";
    const isBot = BOT_PATTERNS.test(userAgent);

    if (!isBot) {
      return new Response(null, {
        status: 302,
        headers: { Location: originalUrl },
      });
    }

    if (!bizSlug) {
      return new Response(null, { status: 302, headers: { Location: originalUrl } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get business by slug
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, logo_url")
      .eq("slug", bizSlug)
      .single();

    if (!business) {
      return new Response(null, { status: 302, headers: { Location: originalUrl } });
    }

    // If product ID provided, fetch product
    if (productoId) {
      const { data: product } = await supabase
        .from("products")
        .select("id, name, description, price, image_url")
        .eq("id", productoId)
        .eq("business_id", business.id)
        .single();

      if (!product) {
        return new Response(null, { status: 302, headers: { Location: originalUrl } });
      }

      const imageUrl = product.image_url || business.logo_url || "";
      const description = product.description || `Disponible en ${business.name}`;
      const priceStr = formatPrice(Number(product.price));

      const html = buildOgHtml({
        title: `${product.name} - ${business.name}`,
        ogTitle: `${product.name} - $${priceStr}`,
        description,
        imageUrl,
        url: originalUrl,
        siteName: `${business.name} — Bivoo`,
      });

      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
      });
    }

    // No product — return business-level OG
    const { data: settings } = await supabase
      .from("store_settings")
      .select("about_text")
      .eq("business_id", business.id)
      .maybeSingle();

    const description = settings?.about_text || `Tienda en línea de ${business.name}`;
    const imageUrl = business.logo_url || "";

    const html = buildOgHtml({
      title: business.name,
      ogTitle: business.name,
      description,
      imageUrl,
      url: originalUrl,
      siteName: `${business.name} — Bivoo`,
    });

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  } catch {
    const originalUrl = new URL(req.url).searchParams.get("url") || req.url;
    return new Response(null, { status: 302, headers: { Location: originalUrl } });
  }
});

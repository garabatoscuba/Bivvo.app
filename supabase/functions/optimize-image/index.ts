import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

interface OptimizeRequest {
  bucket: string;
  path: string;
  type: "product" | "hero" | "promo" | "logo";
}

const LIMITS: Record<string, { maxWidth: number; maxBytes: number; initialQuality: number }> = {
  product: { maxWidth: 1200, maxBytes: 150 * 1024, initialQuality: 75 },
  hero: { maxWidth: 1920, maxBytes: 300 * 1024, initialQuality: 80 },
  promo: { maxWidth: 1200, maxBytes: 200 * 1024, initialQuality: 78 },
  logo: { maxWidth: 512, maxBytes: 100 * 1024, initialQuality: 80 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify user
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: OptimizeRequest = await req.json();
    const { bucket, path, type } = body;

    if (!bucket || !path || !type || !LIMITS[type]) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid params: bucket, path, type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const limits = LIMITS[type];

    // Download original from storage
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage
      .from(bucket)
      .download(path);
    if (dlErr || !fileData) {
      return new Response(
        JSON.stringify({ error: "Could not download file: " + (dlErr?.message || "unknown") }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const originalBytes = await fileData.arrayBuffer();
    const originalSize = originalBytes.byteLength;

    // Use OffscreenCanvas (available in Deno) to decode, resize, and re-encode
    // Deno supports createImageBitmap + OffscreenCanvas
    const blob = new Blob([originalBytes]);
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob);
    } catch {
      return new Response(
        JSON.stringify({ error: "No se pudo decodificar la imagen. Verifica el formato." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Calculate new dimensions maintaining aspect ratio
    let newWidth = bitmap.width;
    let newHeight = bitmap.height;
    if (newWidth > limits.maxWidth) {
      const ratio = limits.maxWidth / newWidth;
      newWidth = limits.maxWidth;
      newHeight = Math.round(bitmap.height * ratio);
    }

    // Draw onto OffscreenCanvas
    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    bitmap.close();

    // Encode as WEBP with progressive quality reduction
    let quality = limits.initialQuality / 100;
    let resultBlob: Blob;
    let attempts = 0;

    do {
      resultBlob = await canvas.convertToBlob({ type: "image/webp", quality });
      if (resultBlob.size <= limits.maxBytes || quality <= 0.2) break;
      quality -= 0.05;
      attempts++;
    } while (attempts < 15);

    const resultBuffer = await resultBlob.arrayBuffer();
    const newSize = resultBuffer.byteLength;

    // Determine new path with .webp extension
    const pathParts = path.split(".");
    pathParts[pathParts.length - 1] = "webp";
    const newPath = pathParts.join(".");

    // Upload optimized image (overwrite)
    const { error: upErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(newPath, new Uint8Array(resultBuffer), {
        upsert: true,
        contentType: "image/webp",
      });
    if (upErr) {
      return new Response(
        JSON.stringify({ error: "Upload failed: " + upErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If original had a different extension, remove the old file
    if (newPath !== path) {
      await supabaseAdmin.storage.from(bucket).remove([path]);
    }

    // Get new public URL
    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(newPath);

    return new Response(
      JSON.stringify({
        originalSize,
        newSize,
        newPath,
        publicUrl: urlData.publicUrl,
        alreadyOptimal: originalSize <= limits.maxBytes && path.endsWith(".webp"),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

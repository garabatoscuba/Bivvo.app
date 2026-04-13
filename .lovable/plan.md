

## Plan: Arreglar imágenes de productos — eliminar edge function rota, optimizar en el cliente

### Problema raíz

La edge function `optimize-image` tiene dos errores fatales que impiden que funcione en Deno Deploy (el runtime de las edge functions):

1. **`auth.getClaims()` no existe** en el SDK de Supabase JS — la autenticación falla silenciosamente
2. **`createImageBitmap` y `OffscreenCanvas` no están disponibles** en Deno Deploy — solo existen en navegadores y Web Workers

Resultado: la función falla, el catch del frontend genera una URL del archivo original (con extensión .jpg/.png), pero el archivo original ya fue borrado por el upload con `upsert: true` o nunca se guarda correctamente. La URL guardada en la base de datos apunta a un archivo que no existe o no es accesible.

### Solución

Mover la optimización al navegador usando la Canvas API nativa (que sí soporta todo esto) y eliminar la dependencia de la edge function.

### Cambios

**1. Reescribir `src/hooks/useImageOptimizer.ts`**
- Optimizar la imagen en el navegador con `createImageBitmap` + `OffscreenCanvas` + `convertToBlob` (WebP)
- Redimensionar y comprimir según los mismos límites (product: 1200px/150KB, hero: 1920px/300KB, promo: 1200px/200KB, logo: 512px/100KB)
- Reducir calidad progresivamente hasta cumplir el peso
- Subir el resultado ya optimizado directamente a Supabase Storage con extensión `.webp`
- Devolver la URL pública del archivo subido
- Mostrar el mismo feedback: "Imagen optimizada: de X → Y" o "Imagen lista"

**2. Eliminar `supabase/functions/optimize-image/index.ts`**
- Borrar el archivo de la edge function
- Quitar la entrada `[functions.optimize-image]` de `supabase/config.toml`

**3. Sin cambios en**
- ProductForm, StoreSettings, PromoBlocksConfig (siguen llamando `imgOptimizer.uploadAndOptimize` igual)
- OptimizationStatus (mismo contrato de props)
- Base de datos, POS, ni ningún otro módulo

### Detalle técnico

```text
Flujo actual (roto):
  File → upload a Storage → invoke edge function → ❌ falla → URL rota

Flujo nuevo:
  File → Canvas resize+WebP en navegador → upload .webp a Storage → URL válida
```

La Canvas API del navegador soporta `createImageBitmap`, `OffscreenCanvas`, y `convertToBlob({ type: "image/webp" })` en todos los navegadores modernos. Si el navegador no soporta WebP encoding (Safari viejo), se sube como PNG como fallback.

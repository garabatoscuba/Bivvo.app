import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ImageType = 'product' | 'hero' | 'promo' | 'logo';

const LIMITS: Record<ImageType, { maxWidth: number; maxBytes: number; initialQuality: number }> = {
  product: { maxWidth: 1200, maxBytes: 150 * 1024, initialQuality: 75 },
  hero: { maxWidth: 1920, maxBytes: 300 * 1024, initialQuality: 80 },
  promo: { maxWidth: 1200, maxBytes: 200 * 1024, initialQuality: 78 },
  logo: { maxWidth: 512, maxBytes: 100 * 1024, initialQuality: 80 },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function optimizeInBrowser(file: File, type: ImageType): Promise<{ blob: Blob; originalSize: number }> {
  const limits = LIMITS[type];
  const originalSize = file.size;

  const bitmap = await createImageBitmap(file);

  let newWidth = bitmap.width;
  let newHeight = bitmap.height;
  if (newWidth > limits.maxWidth) {
    const ratio = limits.maxWidth / newWidth;
    newWidth = limits.maxWidth;
    newHeight = Math.round(bitmap.height * ratio);
  }

  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  // Try WebP with progressive quality reduction
  let quality = limits.initialQuality / 100;
  let blob: Blob;
  let attempts = 0;
  let useWebP = true;

  do {
    try {
      blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    } catch {
      // Safari fallback to PNG
      useWebP = false;
      blob = await canvas.convertToBlob({ type: 'image/png' });
      break;
    }
    if (blob.size <= limits.maxBytes || quality <= 0.2) break;
    quality -= 0.05;
    attempts++;
  } while (attempts < 15);

  return { blob: blob!, originalSize };
}

export function useImageOptimizer() {
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState<{ message: string; variant: 'success' | 'info' } | null>(null);

  const uploadAndOptimize = async (
    file: File,
    bucket: string,
    path: string,
    type: ImageType,
  ): Promise<{ publicUrl: string } | null> => {
    setOptimizing(true);
    setResult(null);
    try {
      const { blob, originalSize } = await optimizeInBrowser(file, type);
      const newSize = blob.size;

      // Change extension to .webp (or .png for fallback)
      const ext = blob.type === 'image/webp' ? 'webp' : 'png';
      const pathParts = path.split('.');
      pathParts[pathParts.length - 1] = ext;
      const finalPath = pathParts.join('.');

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(finalPath, blob, { upsert: true, contentType: blob.type });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(finalPath);

      const alreadyOptimal = originalSize <= LIMITS[type].maxBytes && file.name.endsWith('.webp');
      if (alreadyOptimal) {
        setResult({ message: 'Imagen lista', variant: 'info' });
      } else {
        setResult({
          message: `Imagen optimizada: de ${formatSize(originalSize)} → ${formatSize(newSize)}`,
          variant: 'success',
        });
      }

      return { publicUrl: urlData.publicUrl };
    } catch (err: any) {
      console.error('Image optimization failed:', err);
      // Fallback: upload original
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        setResult({ message: 'Error al subir imagen', variant: 'info' });
        return null;
      }
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      setResult({ message: 'Subida sin optimizar', variant: 'info' });
      return { publicUrl: urlData.publicUrl };
    } finally {
      setOptimizing(false);
    }
  };

  const clearResult = () => setResult(null);

  return { uploadAndOptimize, optimizing, result, clearResult };
}

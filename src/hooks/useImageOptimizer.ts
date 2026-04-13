import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ImageType = 'product' | 'hero' | 'promo' | 'logo';

interface OptimizeResult {
  publicUrl: string;
  originalSize: number;
  newSize: number;
  alreadyOptimal: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
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
      // 1. Upload original
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // 2. Call optimize edge function
      const { data, error: fnErr } = await supabase.functions.invoke('optimize-image', {
        body: { bucket, path, type },
      });

      if (fnErr) {
        throw new Error(fnErr.message || 'Error de optimización');
      }

      const optimizeData = data as OptimizeResult;

      if (optimizeData.alreadyOptimal) {
        setResult({ message: 'Imagen lista', variant: 'info' });
      } else {
        setResult({
          message: `Imagen optimizada: de ${formatSize(optimizeData.originalSize)} → ${formatSize(optimizeData.newSize)}`,
          variant: 'success',
        });
      }

      return { publicUrl: optimizeData.publicUrl };
    } catch (err: any) {
      // If optimization fails, fallback to original URL
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

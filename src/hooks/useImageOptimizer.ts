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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/optimize-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ bucket, path, type }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error de optimización' }));
        throw new Error(err.error || 'Error de optimización');
      }

      const data: OptimizeResult = await res.json();

      if (data.alreadyOptimal) {
        setResult({ message: 'Imagen lista', variant: 'info' });
      } else {
        setResult({
          message: `Imagen optimizada: de ${formatSize(data.originalSize)} → ${formatSize(data.newSize)}`,
          variant: 'success',
        });
      }

      return { publicUrl: data.publicUrl };
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

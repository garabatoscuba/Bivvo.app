import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, Trash2, Save, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

interface BlockData {
  image_url: string;
  text_primary: string;
  text_secondary: string;
  link_target: string;
}

const emptyBlock: BlockData = { image_url: '', text_primary: '', text_secondary: '', link_target: 'products' };

const PromoBlockEditor = ({
  blockNumber,
  branchId,
  businessId,
}: {
  blockNumber: 1 | 2;
  branchId: string;
  businessId: string;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<BlockData>(emptyBlock);

  const { data: existing } = useQuery({
    queryKey: ['promo-block', branchId, blockNumber],
    queryFn: async () => {
      const { data } = await supabase
        .from('portal_promo_blocks')
        .select('*')
        .eq('branch_id', branchId)
        .eq('block_number', blockNumber)
        .maybeSingle();
      return data;
    },
    enabled: !!branchId,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        image_url: existing.image_url || '',
        text_primary: existing.text_primary || '',
        text_secondary: existing.text_secondary || '',
        link_target: existing.link_target || 'products',
      });
    }
  }, [existing]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const valid = ['image/jpeg', 'image/png', 'image/webp'];
    if (!valid.includes(file.type)) {
      toast({ title: 'Formato no válido', description: 'Solo JPG, PNG o WebP', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: 'Imagen muy pesada', description: 'Máximo 2 MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `promo-${branchId}-${blockNumber}.${ext}`;
      const { error } = await supabase.storage.from('portal-promo').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('portal-promo').getPublicUrl(path);
      setForm(prev => ({ ...prev, image_url: urlData.publicUrl }));
      toast({ title: 'Imagen subida' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: businessId,
        branch_id: branchId,
        block_number: blockNumber,
        image_url: form.image_url || null,
        text_primary: form.text_primary.trim() || null,
        text_secondary: form.text_secondary.trim() || null,
        link_target: form.link_target,
      };
      if (existing) {
        const { error } = await supabase
          .from('portal_promo_blocks')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('portal_promo_blocks')
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-block', branchId, blockNumber] });
      toast({ title: `Bloque ${blockNumber} guardado` });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Bloque {blockNumber}
        </CardTitle>
        <CardDescription>
          {blockNumber === 1
            ? 'Imagen a la izquierda, texto a la derecha (fondo oscuro).'
            : 'Texto a la izquierda, imagen a la derecha (fondo claro).'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Imagen</Label>
          {form.image_url && (
            <div className="relative mb-3 rounded-lg overflow-hidden border border-border">
              <img src={form.image_url} alt={`Bloque ${blockNumber}`} className="w-full h-36 object-cover" />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2 h-7 text-xs"
                onClick={() => setForm(prev => ({ ...prev, image_url: '' }))}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Quitar
              </Button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            Subir imagen
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1">Máx. 2 MB. Formatos: JPG, PNG, WebP.</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Texto principal</Label>
          <Input value={form.text_primary} onChange={e => setForm(prev => ({ ...prev, text_primary: e.target.value }))} placeholder="Ej: Ver nuestras ofertas" className="h-9 text-sm" maxLength={80} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Texto secundario (opcional)</Label>
          <Input value={form.text_secondary} onChange={e => setForm(prev => ({ ...prev, text_secondary: e.target.value }))} placeholder="Ej: Productos frescos cada día" className="h-9 text-sm" maxLength={120} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Enlace</Label>
          <Select value={form.link_target} onValueChange={v => setForm(prev => ({ ...prev, link_target: v }))}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="products">Ir al catálogo de productos</SelectItem>
              <SelectItem value="contact">Ir a Contacto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm">
          {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Guardar bloque {blockNumber}
        </Button>
      </CardContent>
    </Card>
  );
};

const PromoBlocksConfig = () => {
  const { profile } = useAuth();
  const branchId = profile?.branch_id;
  const businessId = profile?.business_id;

  if (!branchId || !businessId) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Bloques promocionales</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Hasta 2 bloques opcionales que aparecen en el Home del portal, entre el texto editorial y el pie de página. Si un bloque no tiene imagen ni texto, no aparecerá.
        </p>
      </div>
      <PromoBlockEditor blockNumber={1} branchId={branchId} businessId={businessId} />
      <PromoBlockEditor blockNumber={2} branchId={branchId} businessId={businessId} />
    </div>
  );
};

export default PromoBlocksConfig;

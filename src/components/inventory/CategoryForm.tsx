import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCategories } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { useEnsureBusiness } from '@/hooks/useEnsureBusiness';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/database';

const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(50),
  color: z.string(),
  description: z.string().max(200).optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
}

const colorOptions = [
  { value: 'pink', label: 'Rosa', class: 'bg-category-pink' },
  { value: 'green', label: 'Verde', class: 'bg-category-green' },
  { value: 'blue', label: 'Azul', class: 'bg-category-blue' },
  { value: 'orange', label: 'Naranja', class: 'bg-category-orange' },
  { value: 'purple', label: 'Púrpura', class: 'bg-category-purple' },
];

export const CategoryForm = ({ open, onOpenChange, category }: CategoryFormProps) => {
  const { profile } = useAuth();
  const { ensureBusiness } = useEnsureBusiness();
  const { createCategory, updateCategory } = useCategories();

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      color: 'blue',
      description: '',
    },
  });

  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        color: category.color,
        description: category.description || '',
      });
    } else {
      form.reset({ name: '', color: 'blue', description: '' });
    }
  }, [category, form]);

  const onSubmit = async (data: CategoryFormData) => {
    let businessId = profile?.business_id;
    if (!businessId) {
      businessId = await ensureBusiness();
      if (!businessId) {
        toast({ title: 'No se pudo inicializar tu negocio. Intenta de nuevo.', variant: 'destructive' });
        return;
      }
    }

    if (category) {
      await updateCategory.mutateAsync({
        id: category.id,
        name: data.name,
        color: data.color,
        description: data.description || null,
      });
    } else {
      await createCategory.mutateAsync({
        name: data.name,
        color: data.color,
        business_id: businessId,
        description: data.description || null,
      });
    }

    onOpenChange(false);
    form.reset();
  };

  const isLoading = createCategory.isPending || updateCategory.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{category ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre de la categoría" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {colorOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <div className={cn('h-4 w-4 rounded', opt.class)} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Descripción opcional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {category ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

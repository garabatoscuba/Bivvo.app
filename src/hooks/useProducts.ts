import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { useOffline } from '@/contexts/OfflineContext';
import { toast } from '@/hooks/use-toast';
import { getAllFromStore, putManyInStore } from '@/lib/offlineDb';
import type { Product, Category } from '@/types/database';

export const useProducts = (overrideBusinessId?: string) => {
  const { profile } = useAuth();
  const { businessId: resolvedBusinessId } = useResolvedBusinessId();
  const { isOnline } = useOffline();
  const queryClient = useQueryClient();
  const businessId = overrideBusinessId || resolvedBusinessId || profile?.business_id;

  const productsQuery = useQuery({
    queryKey: ['products', businessId],
    queryFn: async () => {
      if (!businessId) return [];

      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('products')
            .select(`*, category:categories(*)`)
            .eq('business_id', businessId)
            .order('name');

          if (error) throw error;
          const result = data as (Product & { category: Category | null })[];
          // Cache to IndexedDB
          await putManyInStore('products', result);
          return result;
        } catch (err) {
          console.warn('Products online fetch failed, using cache:', err);
        }
      }

      // Offline fallback
      const cached = await getAllFromStore<Product & { category: Category | null }>('products', 'by-business', businessId);
      return cached.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!businessId,
  });

  const createProduct = useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'code' | 'category'>) => {
      const { data: code } = await supabase.rpc('generate_product_code', {
        _business_id: product.business_id,
      });

      const { data, error } = await supabase
        .from('products')
        .insert({ ...product, code: code || `PRD-${Date.now()}` })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Producto creado exitosamente' });
    },
    onError: (error) => {
      toast({ title: 'Error al crear producto', description: error.message, variant: 'destructive' });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...product }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Producto actualizado' });
    },
    onError: (error) => {
      toast({ title: 'Error al actualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Producto eliminado' });
    },
    onError: (error) => {
      toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
    },
  });

  return {
    products: productsQuery.data || [],
    isLoading: productsQuery.isLoading && !productsQuery.data,
    error: productsQuery.error,
    createProduct,
    updateProduct,
    deleteProduct,
  };
};

export const useCategories = (overrideBusinessId?: string) => {
  const { profile } = useAuth();
  const { businessId: resolvedBusinessId } = useResolvedBusinessId();
  const { isOnline } = useOffline();
  const queryClient = useQueryClient();
  const businessId = overrideBusinessId || resolvedBusinessId || profile?.business_id;

  const categoriesQuery = useQuery({
    queryKey: ['categories', businessId],
    queryFn: async () => {
      if (!businessId) return [];

      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('business_id', businessId)
            .order('name');

          if (error) throw error;
          await putManyInStore('categories', data as Category[]);
          return data as Category[];
        } catch (err) {
          console.warn('Categories online fetch failed, using cache:', err);
        }
      }

      const cached = await getAllFromStore<Category>('categories', 'by-business', businessId);
      return cached.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!businessId,
  });

  const createCategory = useMutation({
    mutationFn: async (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('categories').insert(category).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoría creada' });
    },
    onError: (error) => {
      toast({ title: 'Error al crear categoría', description: error.message, variant: 'destructive' });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...category }: Partial<Category> & { id: string }) => {
      const { data, error } = await supabase.from('categories').update(category).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoría actualizada' });
    },
    onError: (error) => {
      toast({ title: 'Error al actualizar categoría', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoría eliminada' });
    },
    onError: (error) => {
      toast({ title: 'Error al eliminar categoría', description: error.message, variant: 'destructive' });
    },
  });

  return {
    categories: categoriesQuery.data || [],
    isLoading: categoriesQuery.isLoading && !categoriesQuery.data,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};

export const useBranchStock = (branchId?: string) => {
  const { profile } = useAuth();
  const { businessId: resolvedBusinessId } = useResolvedBusinessId();
  const { isOnline } = useOffline();
  const effectiveBusinessId = resolvedBusinessId || profile?.business_id;

  return useQuery({
    queryKey: ['branch-stock', branchId],
    queryFn: async () => {
      if (!branchId) return [];

      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('branch_stock')
            .select(`*, product:products(*, category:categories(*))`)
            .eq('branch_id', branchId);

          if (error) throw error;
          await putManyInStore('branch_stock', data || []);
          return data;
        } catch (err) {
          console.warn('BranchStock online fetch failed, using cache:', err);
        }
      }

      return getAllFromStore<any>('branch_stock', 'by-branch', branchId);
    },
    enabled: !!branchId && !!effectiveBusinessId,
  });
};

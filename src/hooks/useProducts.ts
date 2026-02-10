import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { Product, Category } from '@/types/database';

export const useProducts = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ['products', profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('business_id', profile.business_id)
        .order('name');

      if (error) throw error;
      return data as (Product & { category: Category | null })[];
    },
    enabled: !!profile?.business_id,
  });

  const createProduct = useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'code'>) => {
      // Generar código automáticamente
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
      toast({ 
        title: 'Error al crear producto', 
        description: error.message,
        variant: 'destructive' 
      });
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
      toast({ 
        title: 'Error al actualizar', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Producto eliminado' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error al eliminar', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return {
    products: productsQuery.data || [],
    isLoading: productsQuery.isLoading,
    error: productsQuery.error,
    createProduct,
    updateProduct,
    deleteProduct,
  };
};

export const useCategories = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ['categories', profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return [];
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('business_id', profile.business_id)
        .order('name');

      if (error) throw error;
      return data as Category[];
    },
    enabled: !!profile?.business_id,
  });

  const createCategory = useMutation({
    mutationFn: async (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('categories')
        .insert(category)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoría creada' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error al crear categoría', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...category }: Partial<Category> & { id: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(category)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoría actualizada' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error al actualizar categoría', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoría eliminada' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error al eliminar categoría', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return {
    categories: categoriesQuery.data || [],
    isLoading: categoriesQuery.isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};

export const useBranchStock = (branchId?: string) => {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['branch-stock', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      
      const { data, error } = await supabase
        .from('branch_stock')
        .select(`
          *,
          product:products(*, category:categories(*))
        `)
        .eq('branch_id', branchId);

      if (error) throw error;
      return data;
    },
    enabled: !!branchId && !!profile?.business_id,
  });
};

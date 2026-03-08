
-- 1. Catálogo base de tipos de insumo
CREATE TABLE public.print_material_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unidad',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.print_material_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read material types" ON public.print_material_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage material types" ON public.print_material_types FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

-- 2. Inventario de insumos por negocio/sucursal
CREATE TABLE public.raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  material_type_id uuid REFERENCES public.print_material_types(id) ON DELETE SET NULL,
  name text NOT NULL,
  stock_almacen numeric NOT NULL DEFAULT 0,
  stock_vendedor numeric NOT NULL DEFAULT 0,
  stock_minimo numeric NOT NULL DEFAULT 0,
  costo_unitario numeric NOT NULL DEFAULT 0,
  porcentaje_tinta numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
-- Owner/manager: full access by business_id
CREATE POLICY "Owner/manager read raw_materials" ON public.raw_materials FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'owner') AND business_id = public.get_user_business_id(auth.uid())
  OR public.has_role(auth.uid(), 'manager') AND business_id = public.get_user_business_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Owner/manager write raw_materials" ON public.raw_materials FOR INSERT TO authenticated WITH CHECK (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Owner/manager update raw_materials" ON public.raw_materials FOR UPDATE TO authenticated USING (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Owner/manager delete raw_materials" ON public.raw_materials FOR DELETE TO authenticated USING (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  AND business_id = public.get_user_business_id(auth.uid())
);
-- Seller: read only name/stock (no cost), filtered by branch via function
CREATE POLICY "Seller read raw_materials" ON public.raw_materials FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'seller')
  AND business_id = public.get_user_business_id(auth.uid())
);

-- 3. Entradas al almacén
CREATE TABLE public.raw_material_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  cantidad numeric NOT NULL DEFAULT 0,
  costo_unitario numeric NOT NULL DEFAULT 0,
  nota text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raw_material_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/manager read raw_material_entries" ON public.raw_material_entries FOR SELECT TO authenticated USING (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager') OR public.is_super_admin(auth.uid()))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Owner/manager insert raw_material_entries" ON public.raw_material_entries FOR INSERT TO authenticated WITH CHECK (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  AND business_id = public.get_user_business_id(auth.uid())
);

-- 4. Transferencias almacén→vendedor
CREATE TABLE public.raw_material_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  cantidad numeric NOT NULL DEFAULT 0,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raw_material_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/manager read transfers" ON public.raw_material_transfers FOR SELECT TO authenticated USING (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager') OR public.is_super_admin(auth.uid()))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Owner/manager insert transfers" ON public.raw_material_transfers FOR INSERT TO authenticated WITH CHECK (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  AND business_id = public.get_user_business_id(auth.uid())
);

-- 5. Tipos de servicio configurables por negocio
CREATE TABLE public.print_service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_label text NOT NULL DEFAULT 'hoja',
  precio_base numeric NOT NULL DEFAULT 0,
  admite_doble_cara boolean NOT NULL DEFAULT false,
  material_id uuid REFERENCES public.raw_materials(id) ON DELETE SET NULL,
  consumo_por_unidad numeric NOT NULL DEFAULT 1,
  rendimiento_especial jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.print_service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/manager full print_service_types" ON public.print_service_types FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager') OR public.is_super_admin(auth.uid()))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Seller read print_service_types" ON public.print_service_types FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'seller')
  AND business_id = public.get_user_business_id(auth.uid())
);

-- 6. Trabajos cobrados
CREATE TABLE public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/manager read print_jobs" ON public.print_jobs FOR SELECT TO authenticated USING (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager') OR public.is_super_admin(auth.uid()))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Owner/manager insert print_jobs" ON public.print_jobs FOR INSERT TO authenticated WITH CHECK (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Seller insert print_jobs" ON public.print_jobs FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'seller')
  AND business_id = public.get_user_business_id(auth.uid())
  AND user_id = auth.uid()
);
CREATE POLICY "Seller read own print_jobs" ON public.print_jobs FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'seller')
  AND business_id = public.get_user_business_id(auth.uid())
  AND user_id = auth.uid()
);

-- 7. Líneas de cada trabajo
CREATE TABLE public.print_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  service_type_id uuid REFERENCES public.print_service_types(id) ON DELETE SET NULL,
  cantidad numeric NOT NULL DEFAULT 0,
  es_doble_cara boolean NOT NULL DEFAULT false,
  precio_cobrado numeric NOT NULL DEFAULT 0,
  costo_insumo numeric NOT NULL DEFAULT 0,
  material_consumido numeric NOT NULL DEFAULT 0,
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.print_job_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/manager read print_job_items" ON public.print_job_items FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.print_jobs pj
    WHERE pj.id = print_job_items.job_id
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager') OR public.is_super_admin(auth.uid()))
    AND pj.business_id = public.get_user_business_id(auth.uid())
  )
);
CREATE POLICY "Authenticated insert print_job_items" ON public.print_job_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.print_jobs pj
    WHERE pj.id = print_job_items.job_id
    AND pj.business_id = public.get_user_business_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'manager')
      OR (public.has_role(auth.uid(), 'seller') AND pj.user_id = auth.uid())
    )
  )
);
CREATE POLICY "Seller read own print_job_items" ON public.print_job_items FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.print_jobs pj
    WHERE pj.id = print_job_items.job_id
    AND public.has_role(auth.uid(), 'seller')
    AND pj.user_id = auth.uid()
  )
);

-- 8. Mermas de impresión
CREATE TABLE public.print_shrinkage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  cantidad numeric NOT NULL DEFAULT 0,
  motivo text,
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.print_shrinkage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/manager read print_shrinkage" ON public.print_shrinkage FOR SELECT TO authenticated USING (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager') OR public.is_super_admin(auth.uid()))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Owner/manager insert print_shrinkage" ON public.print_shrinkage FOR INSERT TO authenticated WITH CHECK (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Seller insert print_shrinkage" ON public.print_shrinkage FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'seller')
  AND business_id = public.get_user_business_id(auth.uid())
  AND user_id = auth.uid()
);

-- 9. Recetas de productos fabricados
CREATE TABLE public.print_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  descripcion text,
  unidades_produce numeric NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.print_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/manager full print_recipes" ON public.print_recipes FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager') OR public.is_super_admin(auth.uid()))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Seller read print_recipes" ON public.print_recipes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'seller')
  AND business_id = public.get_user_business_id(auth.uid())
);

-- 10. Insumos por receta
CREATE TABLE public.print_recipe_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.print_recipes(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  cantidad_por_produccion numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.print_recipe_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/manager full print_recipe_materials" ON public.print_recipe_materials FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.print_recipes pr
    WHERE pr.id = print_recipe_materials.recipe_id
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager') OR public.is_super_admin(auth.uid()))
    AND pr.business_id = public.get_user_business_id(auth.uid())
  )
);
CREATE POLICY "Seller read print_recipe_materials" ON public.print_recipe_materials FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.print_recipes pr
    WHERE pr.id = print_recipe_materials.recipe_id
    AND public.has_role(auth.uid(), 'seller')
    AND pr.business_id = public.get_user_business_id(auth.uid())
  )
);

-- 11. Registros de producción
CREATE TABLE public.print_productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  recipe_id uuid NOT NULL REFERENCES public.print_recipes(id) ON DELETE CASCADE,
  cantidad_producida numeric NOT NULL DEFAULT 0,
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.print_productions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/manager read print_productions" ON public.print_productions FOR SELECT TO authenticated USING (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager') OR public.is_super_admin(auth.uid()))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Owner/manager insert print_productions" ON public.print_productions FOR INSERT TO authenticated WITH CHECK (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  AND business_id = public.get_user_business_id(auth.uid())
);
CREATE POLICY "Seller insert print_productions" ON public.print_productions FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'seller')
  AND business_id = public.get_user_business_id(auth.uid())
  AND user_id = auth.uid()
);

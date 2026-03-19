
-- Allow owners/managers to update product_stock_entries for voiding
CREATE POLICY "Owner/manager can update product_stock_entries"
ON public.product_stock_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.business_id = product_stock_entries.business_id
  )
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.business_id = product_stock_entries.business_id
  )
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

-- Allow owners/managers to update raw_material_entries for voiding
CREATE POLICY "Owner/manager can update raw_material_entries"
ON public.raw_material_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.business_id = raw_material_entries.business_id
  )
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.business_id = raw_material_entries.business_id
  )
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

-- Allow owners/managers to update inventory_movements for voiding
CREATE POLICY "Owner/manager can update inventory_movements"
ON public.inventory_movements
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.branches b
    JOIN public.profiles p ON p.business_id = b.business_id
    WHERE b.id = inventory_movements.branch_id
      AND p.user_id = auth.uid()
  )
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.branches b
    JOIN public.profiles p ON p.business_id = b.business_id
    WHERE b.id = inventory_movements.branch_id
      AND p.user_id = auth.uid()
  )
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

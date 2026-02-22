
-- Allow employees to view their employer's products
CREATE POLICY "Employees can view employer products"
ON public.products FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid()
    AND e.business_id = products.business_id
  )
);

-- Allow employees to view their employer's categories
CREATE POLICY "Employees can view employer categories"
ON public.categories FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid()
    AND e.business_id = categories.business_id
  )
);

-- Allow employees to view their employer's branch stock
CREATE POLICY "Employees can view employer branch stock"
ON public.branch_stock FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid()
    AND e.business_id = get_branch_business_id(branch_stock.branch_id)
  )
);

-- Allow employees to view their employer's sales
CREATE POLICY "Employees can view employer sales"
ON public.sales FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid()
    AND e.business_id = get_branch_business_id(sales.branch_id)
  )
);

-- Allow employees to create sales for their employer
CREATE POLICY "Employees can create employer sales"
ON public.sales FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid()
    AND e.business_id = get_branch_business_id(sales.branch_id)
  )
  AND user_id = auth.uid()
);

-- Allow employees to view sale items for employer sales
CREATE POLICY "Employees can view employer sale items"
ON public.sale_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    JOIN public.employees e ON e.business_id = get_branch_business_id(s.branch_id)
    JOIN public.profiles p ON p.email = e.email
    WHERE s.id = sale_items.sale_id
    AND p.user_id = auth.uid()
  )
);

-- Allow employees to create sale items for employer sales
CREATE POLICY "Employees can create employer sale items"
ON public.sale_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales s
    JOIN public.employees e ON e.business_id = get_branch_business_id(s.branch_id)
    JOIN public.profiles p ON p.email = e.email
    WHERE s.id = sale_items.sale_id
    AND p.user_id = auth.uid()
  )
);

-- Allow employees to view employer branches (needed for branch context)
CREATE POLICY "Employees can view employer branches"
ON public.branches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid()
    AND e.business_id = branches.business_id
  )
);

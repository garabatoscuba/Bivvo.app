-- 1) Robust employee access by auth_user_id (without relying on email match)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='products'
      AND policyname='Employees(auth_user) can view employer products'
  ) THEN
    CREATE POLICY "Employees(auth_user) can view employer products"
    ON public.products
    FOR SELECT
    TO public
    USING (public.is_employee_of_business(auth.uid(), business_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='categories'
      AND policyname='Employees(auth_user) can view employer categories'
  ) THEN
    CREATE POLICY "Employees(auth_user) can view employer categories"
    ON public.categories
    FOR SELECT
    TO public
    USING (public.is_employee_of_business(auth.uid(), business_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='branches'
      AND policyname='Employees(auth_user) can view employer branches'
  ) THEN
    CREATE POLICY "Employees(auth_user) can view employer branches"
    ON public.branches
    FOR SELECT
    TO public
    USING (public.is_employee_of_business(auth.uid(), business_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='branch_stock'
      AND policyname='Employees(auth_user) can view employer branch stock'
  ) THEN
    CREATE POLICY "Employees(auth_user) can view employer branch stock"
    ON public.branch_stock
    FOR SELECT
    TO public
    USING (public.is_employee_of_business(auth.uid(), public.get_branch_business_id(branch_id)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='sales'
      AND policyname='Employees(auth_user) can view employer sales'
  ) THEN
    CREATE POLICY "Employees(auth_user) can view employer sales"
    ON public.sales
    FOR SELECT
    TO public
    USING (public.is_employee_of_business(auth.uid(), public.get_branch_business_id(branch_id)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='sales'
      AND policyname='Employees(auth_user) can create employer sales'
  ) THEN
    CREATE POLICY "Employees(auth_user) can create employer sales"
    ON public.sales
    FOR INSERT
    TO public
    WITH CHECK (
      public.is_employee_of_business(auth.uid(), public.get_branch_business_id(branch_id))
      AND user_id = auth.uid()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='sale_items'
      AND policyname='Employees(auth_user) can view employer sale items'
  ) THEN
    CREATE POLICY "Employees(auth_user) can view employer sale items"
    ON public.sale_items
    FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1
        FROM public.sales s
        WHERE s.id = sale_items.sale_id
          AND public.is_employee_of_business(auth.uid(), public.get_branch_business_id(s.branch_id))
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='sale_items'
      AND policyname='Employees(auth_user) can create employer sale items'
  ) THEN
    CREATE POLICY "Employees(auth_user) can create employer sale items"
    ON public.sale_items
    FOR INSERT
    TO public
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.sales s
        WHERE s.id = sale_items.sale_id
          AND public.is_employee_of_business(auth.uid(), public.get_branch_business_id(s.branch_id))
      )
    );
  END IF;
END $$;

-- 2) Backfill historical sale_items cost_price when it was saved as 0/null
WITH candidate_costs AS (
  SELECT
    si.id,
    COALESCE(
      (
        SELECT pse.unit_cost
        FROM public.product_stock_entries pse
        WHERE pse.product_id = si.product_id
          AND pse.business_id = public.get_branch_business_id(s.branch_id)
          AND (pse.branch_id = s.branch_id OR pse.branch_id IS NULL)
          AND pse.unit_cost > 0
          AND pse.created_at <= s.created_at
        ORDER BY pse.created_at DESC
        LIMIT 1
      ),
      (
        SELECT p.cost_price
        FROM public.products p
        WHERE p.id = si.product_id
          AND p.cost_price > 0
        LIMIT 1
      )
    ) AS fallback_cost
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE COALESCE(si.cost_price, 0) = 0
)
UPDATE public.sale_items si
SET cost_price = c.fallback_cost
FROM candidate_costs c
WHERE si.id = c.id
  AND c.fallback_cost IS NOT NULL;
-- Allow users who are employees of a business to view its service categories
CREATE POLICY "Employees can view their employer service categories"
ON public.service_categories
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid()
    AND e.business_id = service_categories.business_id
  )
);

-- Allow users who are employees of a business to view its service entries
CREATE POLICY "Employees can view their employer service entries"
ON public.service_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid()
    AND e.business_id = service_entries.business_id
  )
);

-- Allow employees to create service entries for their employer business
CREATE POLICY "Employees can create service entries for employer"
ON public.service_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid()
    AND e.business_id = service_entries.business_id
  )
  AND user_id = auth.uid()
);
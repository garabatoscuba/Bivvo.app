
-- Allow employees to view their employer's business record
CREATE POLICY "Employees can view employer business"
  ON public.businesses FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM employees e
      JOIN profiles p ON p.email = e.email
      WHERE p.user_id = auth.uid()
        AND e.business_id = businesses.id
    )
  );

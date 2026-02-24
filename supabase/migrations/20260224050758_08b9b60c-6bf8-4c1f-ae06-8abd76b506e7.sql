CREATE POLICY "Employees can view employer jornadas"
  ON public.jornadas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN profiles p ON p.email = e.email
      WHERE p.user_id = auth.uid()
        AND e.business_id = get_branch_business_id(jornadas.sucursal_id)
    )
  );
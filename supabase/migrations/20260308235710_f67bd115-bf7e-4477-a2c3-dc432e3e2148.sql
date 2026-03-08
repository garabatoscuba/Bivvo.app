-- 1. Add merma_descuento_pct to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS merma_descuento_pct numeric DEFAULT 0 CHECK (merma_descuento_pct >= 0 AND merma_descuento_pct <= 100);

COMMENT ON COLUMN public.employees.merma_descuento_pct IS 'Porcentaje del valor de la merma que se descuenta del salario (0-100)';

-- 2. Add new columns to print_shrinkage table
ALTER TABLE public.print_shrinkage
ADD COLUMN IF NOT EXISTS valor_perdido numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS monto_descuento numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'cobrado', 'perdonado')),
ADD COLUMN IF NOT EXISTS resuelto_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS resuelto_at timestamp with time zone;

COMMENT ON COLUMN public.print_shrinkage.valor_perdido IS 'Valor total de la merma (cantidad x precio_base)';
COMMENT ON COLUMN public.print_shrinkage.monto_descuento IS 'Monto a descontar del salario según porcentaje configurado';
COMMENT ON COLUMN public.print_shrinkage.estado IS 'Estado de la merma: pendiente, cobrado o perdonado';
COMMENT ON COLUMN public.print_shrinkage.resuelto_por IS 'Usuario (dueño) que resolvió la merma';
COMMENT ON COLUMN public.print_shrinkage.resuelto_at IS 'Fecha y hora en que se resolvió la merma';

-- 3. Create employee_salary_deductions table for payroll deductions
CREATE TABLE IF NOT EXISTS public.employee_salary_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  concepto text NOT NULL,
  monto numeric NOT NULL CHECK (monto >= 0),
  referencia_id uuid,
  referencia_tipo text,
  periodo_inicio date NOT NULL,
  periodo_fin date NOT NULL,
  aplicado boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  notas text
);

COMMENT ON TABLE public.employee_salary_deductions IS 'Deducciones de nómina de empleados (mermas, adelantos, etc)';
COMMENT ON COLUMN public.employee_salary_deductions.concepto IS 'Descripción de la deducción';
COMMENT ON COLUMN public.employee_salary_deductions.monto IS 'Monto a descontar';
COMMENT ON COLUMN public.employee_salary_deductions.referencia_id IS 'ID de la entidad relacionada (ej: merma)';
COMMENT ON COLUMN public.employee_salary_deductions.referencia_tipo IS 'Tipo de referencia (ej: merma, adelanto)';
COMMENT ON COLUMN public.employee_salary_deductions.aplicado IS 'Si ya fue aplicada en un cálculo de nómina';

-- 4. Enable RLS on employee_salary_deductions
ALTER TABLE public.employee_salary_deductions ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for employee_salary_deductions
CREATE POLICY "Users can view deductions of their business"
  ON public.employee_salary_deductions
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM public.employees WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and managers can insert deductions"
  ON public.employee_salary_deductions
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT p.business_id FROM public.profiles p
      INNER JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.user_id = auth.uid()
      AND ur.role IN ('owner', 'manager', 'super_admin')
    )
  );

CREATE POLICY "Owners and managers can update deductions"
  ON public.employee_salary_deductions
  FOR UPDATE
  USING (
    business_id IN (
      SELECT p.business_id FROM public.profiles p
      INNER JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.user_id = auth.uid()
      AND ur.role IN ('owner', 'manager', 'super_admin')
    )
  );

-- 6. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_salary_deductions_employee ON public.employee_salary_deductions(employee_id, periodo_inicio, periodo_fin);
CREATE INDEX IF NOT EXISTS idx_salary_deductions_business ON public.employee_salary_deductions(business_id);
CREATE INDEX IF NOT EXISTS idx_print_shrinkage_estado ON public.print_shrinkage(estado, business_id);

-- 7. Add audit log action for print_job_created (if not exists)
-- This is already defined in auditLogger.ts, so no DB change needed
-- Remove the unique constraint on employee_id to allow multiple salary assignments per employee
ALTER TABLE public.employee_salary_assignments DROP CONSTRAINT IF EXISTS employee_salary_assignments_employee_id_fkey;

ALTER TABLE public.employee_salary_assignments
  ADD CONSTRAINT employee_salary_assignments_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id)
  ON DELETE CASCADE;

-- Add unique constraint on (employee_id, modality_id) to prevent duplicate modality assignments
ALTER TABLE public.employee_salary_assignments
  ADD CONSTRAINT employee_salary_assignments_employee_modality_unique
  UNIQUE (employee_id, modality_id);
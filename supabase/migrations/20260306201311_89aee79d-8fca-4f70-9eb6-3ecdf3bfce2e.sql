
-- 1. inventory_movements: make user_id nullable (SET NULL already configured)
ALTER TABLE public.inventory_movements ALTER COLUMN user_id DROP NOT NULL;

-- 2. sales: make user_id nullable (SET NULL already configured)
ALTER TABLE public.sales ALTER COLUMN user_id DROP NOT NULL;

-- 3. product_entries: make user_id nullable + change FK to SET NULL
ALTER TABLE public.product_entries ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.product_entries DROP CONSTRAINT product_entries_user_id_fkey;
ALTER TABLE public.product_entries ADD CONSTRAINT product_entries_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. employee_salary_records: make employee_user_id nullable + change FK to SET NULL
ALTER TABLE public.employee_salary_records ALTER COLUMN employee_user_id DROP NOT NULL;
ALTER TABLE public.employee_salary_records DROP CONSTRAINT employee_salary_records_employee_user_id_fkey;
ALTER TABLE public.employee_salary_records ADD CONSTRAINT employee_salary_records_employee_user_id_fkey 
  FOREIGN KEY (employee_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

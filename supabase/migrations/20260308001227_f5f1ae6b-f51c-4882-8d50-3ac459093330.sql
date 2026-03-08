
CREATE TABLE public.assistant_module_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL UNIQUE,
  instructions TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_module_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage module instructions"
  ON public.assistant_module_instructions
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can read module instructions"
  ON public.assistant_module_instructions
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed all module keys
INSERT INTO public.assistant_module_instructions (module_key) VALUES
  ('dashboard'), ('pos'), ('inventario'), ('servicios'), ('ventas'),
  ('reportes'), ('empleados'), ('nomina'), ('caja'), ('contabilidad'),
  ('pedidos'), ('portal'), ('mi_empleo'), ('mi_red');


-- Table for quick questions (both general and per-module)
CREATE TABLE public.assistant_quick_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT DEFAULT NULL, -- NULL = general/default question
  question TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_quick_questions ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage
CREATE POLICY "super_admin_manage_quick_questions" ON public.assistant_quick_questions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- All authenticated can read active questions
CREATE POLICY "authenticated_read_quick_questions" ON public.assistant_quick_questions
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Seed general (default) questions
INSERT INTO public.assistant_quick_questions (module_key, question, sort_order) VALUES
  (NULL, '¿Por dónde empiezo a configurar mi negocio?', 0),
  (NULL, '¿Qué puedes ayudarme a hacer?', 1);

-- Seed per-module questions
INSERT INTO public.assistant_quick_questions (module_key, question, sort_order) VALUES
  ('dashboard', '¿Qué significa cada tarjeta del dashboard?', 0),
  ('dashboard', '¿Cómo interpreto las alertas de stock?', 1),
  ('pos', '¿Cómo proceso un pago mixto?', 0),
  ('pos', '¿Por qué no aparece un producto aquí?', 1),
  ('inventory', '¿Cómo agrego stock a un producto?', 0),
  ('inventory', '¿Cuál es la diferencia entre almacén y venta?', 1),
  ('services', '¿Cómo creo un servicio nuevo?', 0),
  ('services', '¿Qué es un servicio en vivo?', 1),
  ('employees', '¿Cómo agrego un empleado nuevo?', 0),
  ('employees', '¿Cómo inicio una jornada?', 1),
  ('nomina', '¿Cómo funciona el Mixto Personalizado?', 0),
  ('nomina', '¿Cómo asigno una modalidad a un empleado?', 1),
  ('tesoreria', '¿Qué diferencia hay entre modo Real y Operativo?', 0),
  ('tesoreria', '¿Cómo registro un gasto personal?', 1),
  ('caja', '¿Cómo abro y cierro la caja?', 0),
  ('caja', '¿Qué pasa con el dinero al cerrar la jornada?', 1),
  ('sales', '¿Cómo anulo una venta?', 0),
  ('sales', '¿Qué métodos de pago puedo usar?', 1),
  ('settings', '¿Cómo configuro el stock mínimo?', 0),
  ('settings', '¿Cómo agrego una sucursal?', 1);

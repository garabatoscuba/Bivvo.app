
-- Table: print_ink_inventory (compras de tinta)
CREATE TABLE public.print_ink_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  color TEXT NOT NULL DEFAULT 'negro',
  tipo TEXT NOT NULL DEFAULT 'cartucho',
  cantidad NUMERIC NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL DEFAULT 'unidad',
  ubicacion TEXT NOT NULL DEFAULT 'almacen',
  costo_total NUMERIC NOT NULL DEFAULT 0,
  fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  nota TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: print_ink_usage (bajadas / consumo de tinta)
CREATE TABLE public.print_ink_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  cantidad_consumida NUMERIC NOT NULL DEFAULT 0,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  hojas_impresas INTEGER NOT NULL DEFAULT 0,
  costo_por_hoja NUMERIC NOT NULL DEFAULT 0,
  nota TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for print_ink_inventory
ALTER TABLE public.print_ink_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and managers can manage ink inventory"
ON public.print_ink_inventory
FOR ALL
TO authenticated
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT business_id FROM public.employees WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT business_id FROM public.employees WHERE auth_user_id = auth.uid()
  )
);

-- RLS for print_ink_usage
ALTER TABLE public.print_ink_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and managers can manage ink usage"
ON public.print_ink_usage
FOR ALL
TO authenticated
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT business_id FROM public.employees WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT business_id FROM public.employees WHERE auth_user_id = auth.uid()
  )
);

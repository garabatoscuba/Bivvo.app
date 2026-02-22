
-- Tabla de jornadas laborales
CREATE TABLE public.jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  apertura_at timestamptz NOT NULL DEFAULT now(),
  cierre_at timestamptz,
  duracion_min integer,
  metodo_apertura text NOT NULL CHECK (metodo_apertura IN ('qr','manual_gerente','dispositivo_local')),
  metodo_cierre text CHECK (metodo_cierre IN ('manual','automatico_horario','automatico_inactividad','automatico_medianoche','gerente')),
  incidencia boolean NOT NULL DEFAULT false,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;

-- Empleados ven sus propias jornadas
CREATE POLICY "Users can view own jornadas"
ON public.jornadas FOR SELECT
USING (empleado_id = get_user_profile_id(auth.uid()));

-- Owner y manager ven todas las jornadas de su business
CREATE POLICY "Owner and manager can view business jornadas"
ON public.jornadas FOR SELECT
USING (
  (get_branch_business_id(sucursal_id) = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- Owner y manager pueden gestionar (INSERT/UPDATE/DELETE)
CREATE POLICY "Owner and manager can manage business jornadas"
ON public.jornadas FOR ALL
USING (
  (get_branch_business_id(sucursal_id) = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  (get_branch_business_id(sucursal_id) = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- Empleados pueden insertar su propia jornada
CREATE POLICY "Users can insert own jornada"
ON public.jornadas FOR INSERT
WITH CHECK (empleado_id = get_user_profile_id(auth.uid()));

-- Empleados pueden actualizar su propia jornada (para cierre)
CREATE POLICY "Users can update own jornada"
ON public.jornadas FOR UPDATE
USING (empleado_id = get_user_profile_id(auth.uid()));

-- Super admin
CREATE POLICY "Super admin can manage all jornadas"
ON public.jornadas FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

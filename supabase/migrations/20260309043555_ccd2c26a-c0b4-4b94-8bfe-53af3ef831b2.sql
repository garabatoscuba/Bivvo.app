ALTER TABLE public.print_service_types 
ADD COLUMN vende_por_tramos boolean NOT NULL DEFAULT false,
ADD COLUMN tramos_por_unidad integer NOT NULL DEFAULT 1;

-- Add branch_id to treasury_movements so movements can be tracked per branch
ALTER TABLE public.treasury_movements
ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- Index for filtering by branch
CREATE INDEX idx_treasury_movements_branch ON public.treasury_movements(branch_id);

import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface PlanGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredPlan?: string;
}

const PlanGateModal = ({ open, onOpenChange, requiredPlan = 'Enterprise' }: PlanGateModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="rounded-full bg-primary/10 p-3 mb-2">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle>Disponible en Plan {requiredPlan}</DialogTitle>
          <DialogDescription>
            Esta función requiere el plan {requiredPlan}. Mejora tu plan para desbloquearla.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate('/plans');
            }}
          >
            Ver planes
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlanGateModal;

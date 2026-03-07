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
import { ShieldAlert } from 'lucide-react';

interface DowngradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DowngradeModal = ({ open, onOpenChange }: DowngradeModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="rounded-full bg-destructive/10 p-3 mb-2">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <DialogTitle>Función no disponible</DialogTitle>
          <DialogDescription>
            Tu plan gratuito no incluye esta función. Reactiva tu plan para continuar operando.
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

export default DowngradeModal;

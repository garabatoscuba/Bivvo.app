import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Banknote, Smartphone, Loader2, CheckCircle } from 'lucide-react';
import type { CartItem, PaymentType } from '@/types/database';
import { cn } from '@/lib/utils';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  discount: number;
  onConfirm: (paymentType: PaymentType, amountPaid: number) => void;
  isProcessing: boolean;
}

const paymentOptions: { value: PaymentType; label: string; icon: React.ElementType }[] = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'transfer', label: 'Transferencia', icon: Smartphone },
  { value: 'credit', label: 'Crédito', icon: CreditCard },
];

export const PaymentDialog = ({
  open,
  onOpenChange,
  items,
  discount,
  onConfirm,
  isProcessing,
}: PaymentDialogProps) => {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - discount;
  
  const [paymentType, setPaymentType] = useState<PaymentType>('cash');
  const [amountPaid, setAmountPaid] = useState<string>(total.toFixed(2));

  const change = paymentType !== 'credit' 
    ? Math.max(0, Number(amountPaid) - total)
    : 0;

  const canProceed = paymentType === 'credit' || Number(amountPaid) >= total;

  const handleConfirm = () => {
    onConfirm(paymentType, Number(amountPaid));
  };

  // Quick cash amounts
  const quickAmounts = [20, 50, 100, 200, 500];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Procesar Pago</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Artículos ({items.reduce((sum, i) => sum + i.quantity, 0)})</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Descuento</span>
                <span>-${discount.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Type */}
          <div className="space-y-2">
            <Label>Método de Pago</Label>
            <div className="grid grid-cols-4 gap-2">
              {paymentOptions.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={paymentType === opt.value ? 'default' : 'outline'}
                  className={cn(
                    'flex-col h-auto py-3',
                    paymentType === opt.value && 'ring-2 ring-primary'
                  )}
                  onClick={() => setPaymentType(opt.value)}
                >
                  <opt.icon className="h-5 w-5 mb-1" />
                  <span className="text-xs">{opt.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Amount Paid (for non-credit) */}
          {paymentType !== 'credit' && (
            <div className="space-y-2">
              <Label>Monto Recibido</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="text-lg font-medium text-right"
              />
              
              {paymentType === 'cash' && (
                <div className="flex flex-wrap gap-2">
                  {quickAmounts.map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAmountPaid(amount.toString())}
                    >
                      ${amount}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmountPaid(total.toFixed(2))}
                  >
                    Exacto
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Change */}
          {paymentType !== 'credit' && change > 0 && (
            <div className="rounded-lg bg-category-green/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">Cambio</p>
              <p className="text-2xl font-bold text-category-green-foreground">
                ${change.toFixed(2)}
              </p>
            </div>
          )}

          {/* Credit Notice */}
          {paymentType === 'credit' && (
            <div className="rounded-lg bg-category-orange/20 p-4 text-center">
              <p className="text-sm text-category-orange-foreground">
                Esta venta quedará pendiente de cobro
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canProceed || isProcessing}
            className="min-w-32"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirmar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Banknote, Smartphone, Loader2, CheckCircle, RotateCcw } from 'lucide-react';
import type { CartItem, PaymentType } from '@/types/database';
import { cn } from '@/lib/utils';
import { ClientSearchSelect } from '@/components/clients/ClientSearchSelect';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  discount: number;
  onConfirm: (paymentType: PaymentType, amountPaid: number, mixedAmounts?: { cash: number; transfer: number }, customerId?: string | null) => void;
  isProcessing: boolean;
  businessId?: string;
  branchId?: string | null;
  userId?: string;
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
  businessId,
  branchId,
  userId,
}: PaymentDialogProps) => {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - discount;

  const [paymentType, setPaymentType] = useState<PaymentType>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Mixed payment state
  const [isMixed, setIsMixed] = useState(false);
  const [mixedCash, setMixedCash] = useState<string>('0');
  const [mixedTransfer, setMixedTransfer] = useState<string>('0');

  useEffect(() => {
    if (open) {
      setPaymentType('cash');
      setAmountPaid('');
      setIsMixed(false);
      setMixedCash('0');
      setMixedTransfer('0');
      setSelectedClientId(null);
    }
  }, [open]);

  // When mixed cash changes, auto-fill transfer with the remainder
  useEffect(() => {
    if (isMixed) {
      const cashVal = Number(mixedCash) || 0;
      const remainder = Math.max(0, total - cashVal);
      setMixedTransfer(remainder.toFixed(2));
    }
  }, [mixedCash, isMixed, total]);

  const handlePaymentSelect = (value: PaymentType) => {
    if (isMixed) {
      if (value === 'cash' || value === 'transfer') {
        setIsMixed(false);
        setPaymentType(value);
        setAmountPaid(value !== 'cash' ? total.toFixed(2) : '');
        return;
      }
    }

    if (
      (paymentType === 'cash' && value === 'transfer') ||
      (paymentType === 'transfer' && value === 'cash')
    ) {
      setIsMixed(true);
      setMixedCash('0');
      setMixedTransfer(total.toFixed(2));
      return;
    }

    setIsMixed(false);
    setPaymentType(value);
    // Auto-fill amount for transfer, card, credit
    if (value === 'transfer' || value === 'card' || value === 'credit') {
      setAmountPaid(total.toFixed(2));
    } else {
      setAmountPaid('');
    }
  };

  const change = !isMixed && paymentType !== 'credit'
    ? Math.max(0, Number(amountPaid) - total)
    : 0;

  const canProceed = isMixed
    ? (Number(mixedCash) + Number(mixedTransfer)) >= total
    : paymentType === 'credit' || (amountPaid !== '' && Number(amountPaid) > 0 && Number(amountPaid) >= total);

  const handleConfirm = () => {
    if (isMixed) {
      const cashVal = Number(mixedCash);
      const transferVal = Number(mixedTransfer);
      onConfirm('mixed', cashVal + transferVal, { cash: cashVal, transfer: transferVal }, selectedClientId);
    } else {
      onConfirm(paymentType, Number(amountPaid), undefined, selectedClientId);
    }
  };

  const quickAmounts = [1, 5, 10, 20, 50, 100, 200, 500, 1000];

  const isButtonActive = (value: PaymentType) => {
    if (isMixed) return value === 'cash' || value === 'transfer';
    return paymentType === value;
  };

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
                  variant={isButtonActive(opt.value) ? 'default' : 'outline'}
                  className={cn(
                    'flex-col h-auto py-3',
                    isButtonActive(opt.value) && 'ring-2 ring-primary'
                  )}
                  onClick={() => handlePaymentSelect(opt.value)}
                >
                  <opt.icon className="h-5 w-5 mb-1" />
                  <span className="text-xs">{opt.label}</span>
                </Button>
              ))}
            </div>
            {isMixed && (
              <p className="text-xs text-muted-foreground text-center">
                Pago mixto: Efectivo + Transferencia
              </p>
            )}
          </div>

          {/* Mixed Payment Fields */}
          {isMixed && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Banknote className="h-4 w-4" /> Efectivo
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={mixedCash}
                  onChange={(e) => setMixedCash(e.target.value)}
                  className="text-lg font-medium text-right"
                />
                <div className="flex flex-wrap gap-2">
                  {quickAmounts.map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMixedCash((prev) => (Number(prev) + amount).toString())}
                    >
                      ${amount}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMixedCash(total.toFixed(2))}
                  >
                    Exacto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMixedCash('0')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" /> Transferencia
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={mixedTransfer}
                  onChange={(e) => setMixedTransfer(e.target.value)}
                  className="text-lg font-medium text-right"
                />
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Efectivo:</span>
                  <span>${(Number(mixedCash) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transferencia:</span>
                  <span>${(Number(mixedTransfer) || 0).toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Suma:</span>
                  <span className={cn(
                    (Number(mixedCash) + Number(mixedTransfer)) >= total ? 'text-primary' : 'text-destructive'
                  )}>
                    ${((Number(mixedCash) || 0) + (Number(mixedTransfer) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Single Payment Amount (for non-credit, non-mixed) */}
          {!isMixed && paymentType !== 'credit' && (
            <div className="space-y-2">
              <Label>Monto Recibido</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0.00"
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
                      onClick={() => setAmountPaid((prev) => (Number(prev) + amount).toString())}
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmountPaid('')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Change */}
          {!isMixed && paymentType !== 'credit' && change > 0 && (
            <div className="rounded-lg bg-category-green/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">Cambio</p>
              <p className="text-2xl font-bold text-secondary">
                ${change.toFixed(2)}
              </p>
            </div>
          )}

          {/* Credit Notice */}
          {paymentType === 'credit' && !isMixed && (
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

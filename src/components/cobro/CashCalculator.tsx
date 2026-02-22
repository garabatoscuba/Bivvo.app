import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Calculator } from 'lucide-react';

const BILL_DENOMINATIONS = [1, 3, 5, 10, 20, 50, 100, 200, 500, 1000];

const CashCalculator = () => {
  const [bills, setBills] = useState<Record<number, number>>(
    Object.fromEntries(BILL_DENOMINATIONS.map(d => [d, 0]))
  );
  const [transfers, setTransfers] = useState(0);

  const handleBillChange = (denom: number, qty: number) => {
    setBills(prev => ({ ...prev, [denom]: isNaN(qty) ? 0 : qty }));
  };

  const totalCash = BILL_DENOMINATIONS.reduce((sum, d) => sum + d * (bills[d] || 0), 0);
  const grandTotal = totalCash + transfers;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Calculadora de Efectivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-1 text-xs font-medium text-muted-foreground border-b pb-1.5">
          <span>Billete</span>
          <span className="text-center">Cantidad</span>
          <span className="text-right">Total</span>
        </div>
        {BILL_DENOMINATIONS.map(denom => (
          <div key={denom} className="grid grid-cols-3 gap-1 items-center">
            <span className="text-sm font-medium">${denom}</span>
            <Input
              type="number"
              min={0}
              value={bills[denom] || ''}
              onChange={e => handleBillChange(denom, parseInt(e.target.value))}
              className="h-8 text-center text-sm"
              placeholder="0"
            />
            <span className="text-sm font-bold text-right">${(denom * (bills[denom] || 0)).toLocaleString()}</span>
          </div>
        ))}
        <div className="border-t pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total Efectivo</span>
            <span className="text-lg font-bold text-primary">${totalCash.toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 items-center">
            <span className="text-sm font-medium">Transferencias</span>
            <Input
              type="number"
              min={0}
              value={transfers || ''}
              onChange={e => setTransfers(isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value))}
              className="h-8 text-center text-sm"
              placeholder="0"
            />
            <span className="text-sm font-bold text-right">${transfers.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-sm font-bold">Efectivo + Transferencias</span>
            <span className="text-xl font-bold text-primary">${grandTotal.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CashCalculator;

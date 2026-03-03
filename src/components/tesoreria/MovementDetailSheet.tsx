import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ShoppingCart, Wrench, ArrowDownToLine, ArrowUpFromLine, Users, Package,
} from "lucide-react";

interface UnifiedRow {
  id: string;
  date: string;
  type: string;
  typeLabel: string;
  description: string;
  amount: number;
  isIncome: boolean;
  paymentMethod?: string;
  origin?: string;
  category?: string;
  ref?: string;
}

interface Props {
  row: (UnifiedRow & { balance: number }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resolvedName: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  cash: "Efectivo",
  transferencia: "Transferencia",
  transfer: "Transferencia",
  mixto: "Mixto",
  mixed: "Mixto",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  venta_producto: <ShoppingCart className="h-4 w-4" />,
  venta_servicio: <Wrench className="h-4 w-4" />,
  inyeccion: <ArrowDownToLine className="h-4 w-4" />,
  gasto: <ArrowUpFromLine className="h-4 w-4" />,
  salario: <Users className="h-4 w-4" />,
};

export default function MovementDetailSheet({ row, open, onOpenChange, resolvedName }: Props) {
  // Extract the real ID (strip prefix)
  const realId = row?.id?.replace(/^(sale-|svc-|tm-|sal-)/, "") || "";

  // Fetch sale items if it's a product sale
  const { data: saleItems = [] } = useQuery({
    queryKey: ["movement-detail-sale-items", realId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sale_items")
        .select("id, quantity, price, cost_price, product_name")
        .eq("sale_id", realId);
      return data || [];
    },
    enabled: !!row && row.type === "venta_producto" && !!realId,
  });

  // Fetch sale details (cash_amount, transfer_amount) for mixed payments
  const { data: saleDetail } = useQuery({
    queryKey: ["movement-detail-sale", realId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("cash_amount, transfer_amount, notes")
        .eq("id", realId)
        .maybeSingle();
      return data;
    },
    enabled: !!row && row.type === "venta_producto" && !!realId,
  });

  // Fetch service entry details
  const { data: serviceDetail } = useQuery({
    queryKey: ["movement-detail-service", realId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_entries")
        .select("notes, client_name, cash_amount, transfer_amount")
        .eq("id", realId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!row && row.type === "venta_servicio" && !!realId,
  });

  if (!row) return null;

  const fmt = (n: number) => "$" + Math.abs(n).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pmLabel = row.paymentMethod ? (PAYMENT_LABELS[row.paymentMethod.toLowerCase()] || row.paymentMethod) : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className={`rounded-full p-2 ${row.isIncome ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
              {TYPE_ICONS[row.type] || <Package className="h-4 w-4" />}
            </div>
            <div>
              <SheetTitle className="text-base">{row.typeLabel}</SheetTitle>
              {row.ref && (
                <p className="text-xs text-muted-foreground font-mono">{row.ref}</p>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <DetailField label="Fecha" value={format(new Date(row.date), "dd MMM yyyy · HH:mm", { locale: es })} />
            <DetailField label="Monto" value={`${row.isIncome ? "+" : "-"}${fmt(row.amount)}`} className={row.isIncome ? "text-green-600 font-bold" : "text-red-600 font-bold"} />
            <DetailField label="Método de Pago" value={pmLabel} />
            <DetailField label="Responsable" value={resolvedName} />
            {row.category && <DetailField label="Categoría" value={row.category} />}
            <DetailField label="Balance" value={fmt(row.balance)} className={row.balance >= 0 ? "text-foreground font-semibold" : "text-destructive font-semibold"} />
          </div>

          {/* Mixed payment breakdown */}
          {row.type === "venta_producto" && saleDetail && row.paymentMethod?.toLowerCase() === "mixto" && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Desglose de Pago</h4>
                <div className="grid grid-cols-2 gap-2">
                  <DetailField label="Efectivo" value={fmt(Number(saleDetail.cash_amount || 0))} />
                  <DetailField label="Transferencia" value={fmt(Number(saleDetail.transfer_amount || 0))} />
                </div>
              </div>
            </>
          )}


          {/* Sale Items */}
          {row.type === "venta_producto" && saleItems.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Ítems vendidos ({saleItems.length})
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Producto</TableHead>
                        <TableHead className="text-xs text-center">Cant.</TableHead>
                        <TableHead className="text-xs text-right">Precio</TableHead>
                        <TableHead className="text-xs text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saleItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs py-1.5">{item.product_name || "Producto"}</TableCell>
                          <TableCell className="text-xs py-1.5 text-center">{item.quantity}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right">{fmt(Number(item.price))}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-medium">
                            {fmt(Number(item.quantity) * Number(item.price))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {saleItems.some((i: any) => Number(i.cost_price) > 0) && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Costo total: {fmt(saleItems.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.cost_price || 0), 0))}
                    {" · "}
                    Ganancia: <span className="text-green-600 font-medium">
                      {fmt(row.amount - saleItems.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.cost_price || 0), 0))}
                    </span>
                  </p>
                )}
              </div>
            </>
          )}

          {/* Service details */}
          {row.type === "venta_servicio" && serviceDetail && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Detalles del Servicio</h4>
                {serviceDetail.client_name && <DetailField label="Cliente" value={serviceDetail.client_name} />}
                {serviceDetail.notes && <DetailField label="Notas" value={serviceDetail.notes} />}
                {row.paymentMethod?.toLowerCase() === "mixto" && (
                  <div className="grid grid-cols-2 gap-2">
                    <DetailField label="Efectivo" value={fmt(Number(serviceDetail.cash_amount || 0))} />
                    <DetailField label="Transferencia" value={fmt(Number(serviceDetail.transfer_amount || 0))} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Treasury movement details */}
          {(row.type === "inyeccion" || row.type === "gasto") && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Detalles</h4>
                <DetailField label="Motivo" value={row.description} />
                {row.origin && <DetailField label="Origen" value={row.origin} />}
              </div>
            </>
          )}

          {/* Salary details */}
          {row.type === "salario" && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Detalles del Salario</h4>
                <DetailField label="Empleado" value={row.description} />
              </div>
            </>
          )}

          {/* Notes for sales */}
          {row.type === "venta_producto" && saleDetail?.notes && (
            <>
              <Separator />
              <DetailField label="Notas" value={saleDetail.notes} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</p>
      <p className={`text-sm ${className || ""}`}>{value}</p>
    </div>
  );
}

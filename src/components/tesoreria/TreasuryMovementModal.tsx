import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranches } from "@/hooks/useBranches";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingDown, TrendingUp, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  prefillType?: "extraccion" | "inyeccion" | null;
  defaultBranchId?: string | null;
}

export default function TreasuryMovementModal({ open, onOpenChange, businessId, prefillType, defaultBranchId }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: branches = [] } = useBranches();

  const [type, setType] = useState<"extraccion" | "inyeccion">("extraccion");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [reason, setReason] = useState("");
  const [origin, setOrigin] = useState("");
  const [label, setLabel] = useState("negocio");
  const [branchId, setBranchId] = useState<string>("all");
  const [moreOpen, setMoreOpen] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setType(prefillType || "extraccion");
      setAmount("");
      setPaymentMethod("efectivo");
      setCashAmount("");
      setTransferAmount("");
      setReason("");
      setOrigin("");
      setLabel("negocio");
      setBranchId(defaultBranchId || "all");
      setMoreOpen(false);
    }
  }, [open, prefillType, defaultBranchId]);

  const { data: categories = [] } = useQuery({
    queryKey: ["treasury-categories", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("treasury_categories" as any)
        .select("*")
        .eq("business_id", businessId)
        .order("sort_order");
      return (data as any[]) || [];
    },
    enabled: !!businessId && open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const numAmount = Number(amount);
      if (!numAmount || numAmount <= 0) throw new Error("Monto inválido");

      let cash = 0;
      let transfer = 0;
      if (paymentMethod === "efectivo") {
        cash = numAmount;
      } else if (paymentMethod === "transferencia") {
        transfer = numAmount;
      } else {
        cash = Number(cashAmount) || 0;
        transfer = Number(transferAmount) || 0;
        if (Math.abs(cash + transfer - numAmount) > 0.01) {
          throw new Error("La suma de efectivo y transferencia debe coincidir con el monto total");
        }
      }

      const resolvedBranchId = label === "negocio" && branchId !== "all" ? branchId : 
                                label === "negocio" && branches.length === 1 ? branches[0].id : null;

      const { error } = await supabase.from("treasury_movements" as any).insert({
        business_id: businessId,
        branch_id: resolvedBranchId,
        movement_type: type,
        amount: numAmount,
        payment_method: paymentMethod,
        cash_amount: cash,
        transfer_amount: transfer,
        reason: reason.trim() || null,
        origin: origin.trim() || null,
        category_id: categoryId || null,
        label,
        registered_by: profile!.user_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasury-movements"] });
      queryClient.invalidateQueries({ queryKey: ["bh-treasury"] });
      queryClient.invalidateQueries({ queryKey: ["bp-injections"] });
      queryClient.invalidateQueries({ queryKey: ["bp-extractions"] });
      toast({ title: type === "inyeccion" ? "Capital registrado" : "Gasto registrado" });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isExtraction = type === "extraccion";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            {isExtraction ? (
              <TrendingDown className="h-5 w-5 text-destructive" />
            ) : (
              <TrendingUp className="h-5 w-5 text-primary" />
            )}
            {isExtraction ? "Registrar Gasto" : "Registrar Capital"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] px-6">
          <div className="space-y-4 pb-4">
            {/* Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as any)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="extraccion" id="type-ext" />
                  <Label htmlFor="type-ext" className="text-sm cursor-pointer text-destructive font-medium">
                    Extracción
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="inyeccion" id="type-inj" />
                  <Label htmlFor="type-inj" className="text-sm cursor-pointer text-primary font-medium">
                    Inyección
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <Label className="text-sm">Monto</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Payment method */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Método de pago</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                className="flex gap-3"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="efectivo" id="pm-cash" />
                  <Label htmlFor="pm-cash" className="text-sm cursor-pointer">Efectivo</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="transferencia" id="pm-transfer" />
                  <Label htmlFor="pm-transfer" className="text-sm cursor-pointer">Transferencia</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="mixto" id="pm-mixed" />
                  <Label htmlFor="pm-mixed" className="text-sm cursor-pointer">Mixto</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Mixed breakdown */}
            {paymentMethod === "mixto" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Efectivo</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Transferencia</Label>
                  <Input
                    type="number"
                    min={0}
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            {/* Category */}
            <div className="space-y-1">
              <Label className="text-sm">Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Etiqueta</Label>
              <RadioGroup value={label} onValueChange={setLabel} className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="negocio" id="lbl-biz" />
                  <Label htmlFor="lbl-biz" className="text-sm cursor-pointer">Negocio</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="personal" id="lbl-personal" />
                  <Label htmlFor="lbl-personal" className="text-sm cursor-pointer">Personal</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Branch selector (only when label is negocio and multiple branches) */}
            {label === "negocio" && branches.length > 1 && (
              <div className="space-y-1">
                <Label className="text-sm">Sucursal</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas (general)</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-1">
              <Label className="text-sm">Motivo</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe el motivo..."
                rows={2}
              />
            </div>

            {/* Origin */}
            <div className="space-y-1">
              <Label className="text-sm">Origen</Label>
              <Input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Ej: Proveedor X, Cuenta personal..."
              />
            </div>

            {/* Registered by */}
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Registrado por</Label>
              <Input
                value={profile?.full_name || profile?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="px-6 pb-6 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !amount || Number(amount) <= 0}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

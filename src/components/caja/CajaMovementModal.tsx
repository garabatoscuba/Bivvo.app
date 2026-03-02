import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";

interface CajaMovementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "insertion" | "extraction";
  registerId: string;
  branchId: string;
  businessId: string;
}

const CajaMovementModal = ({
  open,
  onOpenChange,
  type,
  registerId,
  branchId,
  businessId,
}: CajaMovementModalProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const isInsertion = type === "insertion";
  const title = isInsertion ? "Insertar en Caja" : "Sacar de Caja";
  const Icon = isInsertion ? ArrowDownToLine : ArrowUpFromLine;

  const mutation = useMutation({
    mutationFn: async () => {
      const numAmount = Number(amount);
      if (!numAmount || numAmount <= 0) throw new Error("Monto inválido");
      const { error } = await supabase.from("cash_register_movements" as any).insert({
        cash_register_id: registerId,
        branch_id: branchId,
        business_id: businessId,
        user_id: profile!.user_id,
        movement_type: type,
        amount: numAmount,
        reason: reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caja-movements"] });
      queryClient.invalidateQueries({ queryKey: ["caja-sales-today"] });
      toast({ title: isInsertion ? "Monto insertado en caja" : "Monto retirado de caja" });
      setAmount("");
      setReason("");
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${isInsertion ? "text-green-600" : "text-red-600"}`} />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm">Monto</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Motivo</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo..."
              rows={2}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Registrado por</Label>
            <Input
              value={profile?.full_name || profile?.email || ""}
              disabled
              className="bg-muted"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !amount || Number(amount) <= 0}
            className={isInsertion ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CajaMovementModal;

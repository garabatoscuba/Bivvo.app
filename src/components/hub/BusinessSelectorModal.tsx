import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState } from "react";

export interface OwnedBusinessOption {
  id: string;
  name: string;
  business_type?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businesses: OwnedBusinessOption[];
  onCreateNew: () => void;
}

const BusinessSelectorModal = ({ open, onOpenChange, businesses, onCreateNew }: Props) => {
  const { profile } = useAuth();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSelect = async (bizId: string) => {
    if (!profile?.user_id) return;
    setLoadingId(bizId);
    try {
      const { data: bizBranches } = await supabase
        .from("branches")
        .select("id")
        .eq("business_id", bizId)
        .eq("is_main", true)
        .limit(1);
      const mainBranchId = bizBranches?.[0]?.id || null;
      await supabase
        .from("profiles")
        .update({ business_id: bizId, branch_id: mainBranchId })
        .eq("user_id", profile.user_id);
      window.location.assign("/dashboard");
    } catch (e) {
      toast.error("No se pudo abrir el negocio");
      setLoadingId(null);
    }
  };

  const getInitial = (name: string) => name?.trim()?.[0]?.toUpperCase() || "B";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Elige un negocio</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          {businesses.map((b) => {
            const isActive = profile?.business_id === b.id;
            const isLoading = loadingId === b.id;
            return (
              <button
                key={b.id}
                disabled={isLoading}
                onClick={() => handleSelect(b.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isActive ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50"
                } disabled:opacity-50`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-medium text-primary flex-shrink-0">
                  {getInitial(b.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{b.name}</div>
                  {b.business_type && (
                    <div className="text-xs text-muted-foreground truncate">{b.business_type}</div>
                  )}
                </div>
                {isActive && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Activo
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          className="w-full gap-2 mt-2"
          onClick={() => {
            onOpenChange(false);
            onCreateNew();
          }}
        >
          <Plus className="h-4 w-4" /> Crear nuevo negocio
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default BusinessSelectorModal;

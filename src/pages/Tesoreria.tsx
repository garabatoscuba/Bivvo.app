import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TreasuryMovimientos from "@/components/tesoreria/TreasuryMovimientos";

const Tesoreria = () => {
  const { profile } = useAuth();
  const { data: branches = [] } = useBranches();

  const [searchParams, setSearchParams] = useSearchParams();
  const prefillType = searchParams.get("prefill") as "extraccion" | "inyeccion" | null;

  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  const handlePrefillConsumed = () => {
    setSearchParams({}, { replace: true });
  };

  const singleBranch = branches.length === 1;
  const effectiveBranchId = singleBranch ? branches[0].id : selectedBranchId;
  const filterBranchId = effectiveBranchId === "all" ? null : effectiveBranchId;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          {singleBranch ? (
            <h1 className="text-xl font-bold tracking-tight">{branches[0].name}</h1>
          ) : branches.length > 1 ? (
            <Select value={effectiveBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-auto min-w-[200px] h-9 text-base font-bold border-none shadow-none px-0 gap-2">
                <SelectValue placeholder="Seleccionar sucursal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <h1 className="text-xl font-bold tracking-tight">Tesorería</h1>
          )}
        </div>

        {profile?.business_id && (
          <TreasuryMovimientos
            businessId={profile.business_id}
            branchId={filterBranchId}
            prefillType={prefillType}
            onPrefillConsumed={handlePrefillConsumed}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Tesoreria;

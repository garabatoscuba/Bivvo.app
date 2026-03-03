import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CajaOwnerOverview from "@/components/caja/CajaOwnerOverview";
import TreasuryMovimientos from "@/components/tesoreria/TreasuryMovimientos";
import { Landmark } from "lucide-react";

const Tesoreria = () => {
  const { profile } = useAuth();
  const { data: branches = [] } = useBranches();
  const activeBranch = branches.find((b) => b.id === profile?.branch_id);

  const [searchParams, setSearchParams] = useSearchParams();
  const prefillType = searchParams.get("prefill") as "extraccion" | "inyeccion" | null;
  const initialTab = prefillType ? "movimientos" : "caja";

  const [mainTab, setMainTab] = useState(initialTab === "caja" ? "movimientos" : initialTab);

  const handlePrefillConsumed = () => {
    setSearchParams({}, { replace: true });
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Tesorería</h1>
            {activeBranch && (
              <p className="text-xs text-muted-foreground">{activeBranch.name}</p>
            )}
          </div>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="w-full grid grid-cols-2 h-9">
            <TabsTrigger value="movimientos" className="text-xs">Balance Personal</TabsTrigger>
            <TabsTrigger value="caja" className="text-xs">Cajas</TabsTrigger>
          </TabsList>

          <TabsContent value="movimientos">
            {profile?.business_id && (
              <TreasuryMovimientos
                businessId={profile.business_id}
                prefillType={prefillType}
                onPrefillConsumed={handlePrefillConsumed}
              />
            )}
          </TabsContent>

          <TabsContent value="caja">
            <CajaOwnerOverview />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Tesoreria;

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Store, Globe } from "lucide-react";

interface PublicBusiness {
  id: string;
  name: string;
  slug: string | null;
  business_type: string;
  keywords: string | null;
  logo_url: string | null;
}

const businessTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    store: "Tienda",
    copy_shop: "Punto de copias",
    "estaurente/safetería": "Restaurante",
    gym: "Gimnasio",
  };
  return map[type] || type;
};

export const HubSearchAndExplore = ({ showWelcome = false }: { showWelcome?: boolean }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: publicBusinesses = [] } = useQuery({
    queryKey: ["hub-public-businesses"],
    queryFn: async () => {
      // Get branches with active store_settings
      const { data: activeSettings } = await supabase
        .from("store_settings")
        .select("branch_id")
        .eq("is_active", true);

      if (!activeSettings?.length) return [];

      const branchIds = activeSettings.map((s) => s.branch_id);
      const { data: branches } = await supabase
        .from("branches")
        .select("business_id")
        .in("id", branchIds);

      if (!branches?.length) return [];

      const bizIds = [...new Set(branches.map((b) => b.business_id))];
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id, name, slug, business_type, keywords, logo_url")
        .in("id", bizIds)
        .eq("is_active", true);

      return (businesses || []) as PublicBusiness[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return publicBusinesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.keywords && b.keywords.toLowerCase().includes(q))
    );
  }, [search, publicBusinesses]);

  const handleOpen = (biz: PublicBusiness) => {
    if (biz.slug) navigate(`/s/${biz.slug}`);
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      {/* Welcome message for empty users */}
      {showWelcome && (
        <div className="mb-6 animate-hub-fade-up">
          <p className="text-[13px] hub-text-muted">
            Explora los negocios activos en Bivoo o crea tu propio negocio desde el menú.
          </p>
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-8 animate-hub-fade-up">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 hub-text-dim pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar negocios en Bivoo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-xl hub-card border-none text-[13px] hub-text placeholder:hub-text-dim focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.3)] transition-all"
        />

        {/* Search results dropdown */}
        {search.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl hub-card shadow-lg z-10 overflow-hidden max-h-[280px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-[12px] hub-text-dim text-center">
                Sin resultados para "{search}"
              </div>
            ) : (
              filtered.map((biz) => (
                <div
                  key={biz.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--hub-hover)] transition-colors"
                  onClick={() => handleOpen(biz)}
                >
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary)/0.08)] flex items-center justify-center flex-shrink-0">
                    {biz.logo_url ? (
                      <img src={biz.logo_url} alt="" className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <span className="text-[10px] font-medium text-[hsl(var(--primary))]">{getInitials(biz.name)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] hub-text truncate">{biz.name}</div>
                    <div className="text-[11px] hub-text-dim truncate">
                      {businessTypeLabel(biz.business_type)}
                      {biz.keywords && ` · ${biz.keywords}`}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Explore section */}
      {publicBusinesses.length > 0 && (
        <div className="mb-9 animate-hub-fade-up">
          <div className="text-[10px] tracking-[0.15em] uppercase hub-text-dim mb-3.5 flex items-center gap-3">
            <Globe className="h-3 w-3" />
            Explorar
            <span className="flex-1 h-px hub-line" />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
            {publicBusinesses.map((biz) => (
              <div
                key={biz.id}
                className="hub-card cursor-pointer"
                onClick={() => handleOpen(biz)}
              >
                <div className="hub-card-arrow">›</div>
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-2.5">
                  {biz.logo_url ? (
                    <img src={biz.logo_url} alt="" className="w-7 h-7 rounded-lg object-cover" />
                  ) : (
                    <Store className="h-4 w-4 hub-text-dim" />
                  )}
                </div>
                <div className="font-['Cormorant_Garamond'] text-[19px] font-medium leading-[1.2] mb-0.5">{biz.name}</div>
                <div className="text-[11px] hub-text-muted">
                  {businessTypeLabel(biz.business_type)}
                  {biz.keywords && (
                    <span className="hub-text-dim"> · {biz.keywords}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

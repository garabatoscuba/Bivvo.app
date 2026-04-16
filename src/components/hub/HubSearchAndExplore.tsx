import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Store, Globe, MapPin } from "lucide-react";
import type { WeekSchedule } from "@/hooks/useStoreSettings";

interface PublicBusiness {
  id: string;
  name: string;
  slug: string | null;
  business_type: string;
  keywords: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  accent_color: string | null;
  schedule: WeekSchedule | null;
  address: string | null;
}

const DAY_KEYS: Record<number, keyof WeekSchedule> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

const isOpenNow = (schedule: WeekSchedule | null): boolean => {
  if (!schedule) return false;
  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const day = schedule[dayKey];
  if (!day?.enabled || !day.open || !day.close) return false;
  const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return current >= day.open && current < day.close;
};

const businessTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    store: "Tienda",
    copy_shop: "Punto de copias",
    "estaurente/safetería": "Restaurante",
    gym: "Gimnasio",
  };
  return map[type] || type;
};

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 45%)`;
};

export const HubSearchAndExplore = ({ showWelcome = false }: { showWelcome?: boolean }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: publicBusinesses = [] } = useQuery({
    queryKey: ["hub-public-businesses"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_public_storefronts");
      if (error || !data) return [];
      return (data as any[]).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        business_type: row.business_type,
        keywords: row.keywords,
        logo_url: row.logo_url,
        hero_image_url: row.hero_image_url,
        accent_color: row.accent_color,
        schedule: row.schedule as WeekSchedule | null,
        address: row.address,
      })) as PublicBusiness[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return publicBusinesses;
    const q = search.toLowerCase();
    return publicBusinesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.keywords && b.keywords.toLowerCase().includes(q))
    );
  }, [search, publicBusinesses]);

  const searchResults = useMemo(() => {
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

  const getKeywordChips = (keywords: string | null) => {
    if (!keywords) return [];
    return keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 4);
  };

  const getLogoUrl = (biz: PublicBusiness) => biz.logo_url || biz.hero_image_url;

  return (
    <>
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
          placeholder="Buscar negocios, servicios, productos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-xl hub-card border-none text-[13px] hub-text placeholder:hub-text-dim focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.3)] transition-all"
        />

        {/* Search results dropdown */}
        {search.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl hub-card shadow-lg z-10 overflow-hidden max-h-[280px] overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="px-4 py-3 text-[12px] hub-text-dim text-center">
                Sin resultados para "{search}"
              </div>
            ) : (
              searchResults.map((biz) => (
                <div
                  key={biz.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--hub-hover)] transition-colors"
                  onClick={() => handleOpen(biz)}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: getLogoUrl(biz) ? undefined : stringToColor(biz.name) }}>
                    {getLogoUrl(biz) ? (
                      <img src={getLogoUrl(biz)!} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-medium text-white">{getInitials(biz.name)}</span>
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

      {/* Explorar en Bivoo */}
      {publicBusinesses.length > 0 && (
        <div className="mb-9 animate-hub-fade-up">
          <div className="text-[10px] tracking-[0.15em] uppercase hub-text-dim mb-3.5 flex items-center gap-3">
            <Globe className="h-3 w-3" />
            Explorar en Bivoo
            <span className="flex-1 h-px hub-line" />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {filtered.map((biz) => {
              const open = isOpenNow(biz.schedule);
              const logo = getLogoUrl(biz);
              const chips = getKeywordChips(biz.keywords);
              return (
                <div
                  key={biz.id}
                  className="hub-card cursor-pointer"
                  onClick={() => handleOpen(biz)}
                >
                  <div className="hub-card-arrow">›</div>
                  <div className="flex items-start gap-3 mb-2">
                    {/* Avatar */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-[hsl(var(--primary)/0.1)]"
                      style={{ backgroundColor: logo ? undefined : stringToColor(biz.name) }}
                    >
                      {logo ? (
                        <img src={logo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-white">{getInitials(biz.name)}</span>
                      )}
                    </div>
                    {/* Badge */}
                    <span
                      className={`mt-0.5 ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        open
                          ? "bg-green-500/15 text-green-600 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {open ? "Abierto" : "Cerrado"}
                    </span>
                  </div>
                  <div className="font-['Cormorant_Garamond'] text-[19px] font-medium leading-[1.2] mb-0.5">{biz.name}</div>
                  <div className="text-[11px] hub-text-muted mb-1.5">
                    {businessTypeLabel(biz.business_type)}
                  </div>
                  {biz.address && (
                    <div className="flex items-center gap-1 text-[11px] hub-text-dim mb-1.5">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{biz.address}</span>
                    </div>
                  )}
                  {chips.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {chips.map((chip) => (
                        <span
                          key={chip}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

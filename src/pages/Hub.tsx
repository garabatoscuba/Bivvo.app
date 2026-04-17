import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SyncStatusModal } from "@/components/layout/SyncStatusModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Cloud,
  MessageSquare,
  Moon,
  Sun,
  ChevronDown,
  LogOut,
  User,
  Search,
  MapPin,
  Loader2,
} from "lucide-react";
import HubEditorial from "@/components/hub/HubEditorial";
import CreateBusinessModal from "@/components/hub/CreateBusinessModal";
import ProfileModal from "@/components/hub/ProfileModal";
import BusinessSelectorModal from "@/components/hub/BusinessSelectorModal";
import { AppLoader } from "@/components/ui/AppLoader";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const Hub = () => {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [syncOpen, setSyncOpen] = useState(false);
  const [createBizOpen, setCreateBizOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [city, setCity] = useState<string>("");
  const [hideTopbar, setHideTopbar] = useState(false);
  const lastScrollY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      if (y < 80) { setHideTopbar(false); lastScrollY.current = y; return; }
      if (y > lastScrollY.current + 8) setHideTopbar(true);
      else if (y < lastScrollY.current - 8) setHideTopbar(false);
      lastScrollY.current = y;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  const isDark = theme === "dark";

  // Debounce search input (250ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Open dropdown when there's text; close when emptied
  useEffect(() => {
    if (search.trim().length >= 2) setSearchOpen(true);
    else setSearchOpen(false);
  }, [search]);

  // Click-outside + Escape to close
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Live search query
  const { data: searchData, isFetching: searchLoading } = useQuery({
    queryKey: ["hub-search", debouncedSearch],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("search_public_catalog", { q: debouncedSearch });
      if (error) throw error;
      return (data || []) as Array<{
        kind: "business" | "product" | "service";
        id: string;
        name: string;
        price: number | null;
        business_id: string;
        business_name: string;
        business_slug: string;
        business_type: string | null;
      }>;
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
  });

  const businessHits = (searchData || []).filter((r) => r.kind === "business");
  const itemHits = (searchData || []).filter((r) => r.kind !== "business");

  const formatPrice = (n: number | null) => {
    if (n == null) return "";
    try { return new Intl.NumberFormat("es", { maximumFractionDigits: 2 }).format(n); }
    catch { return String(n); }
  };

  const goToStorefront = (slug: string) => {
    if (!slug) return;
    setSearchOpen(false);
    setSearch("");
    navigate(`/s/${slug}`);
  };

  // Try to get geolocation → reverse geocode to city (best-effort, silent on fail)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=10&accept-language=es`,
            { headers: { "Accept": "application/json" } }
          );
          const data = await res.json();
          const c = data?.address?.city || data?.address?.town || data?.address?.state || "";
          const country = data?.address?.country || "";
          if (c) setCity(country ? `${c}, ${country}` : c);
        } catch { /* silent */ }
      },
      () => { /* user denied — silent */ },
      { timeout: 5000, maximumAge: 600000 }
    );
  }, []);

  // Owned businesses (for stat: count + alerts)
  const { data: ownedBusinesses = [], isLoading: loadingOwned } = useQuery({
    queryKey: ["hub-owned-stat", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data: bizList } = await supabase
        .from("businesses")
        .select("id, name, business_type")
        .eq("owner_id", profile.id)
        .eq("is_active", true);
      if (!bizList?.length) return [];
      const bizIds = bizList.map((b) => b.id);
      const { data: branches } = await supabase
        .from("branches").select("id").in("business_id", bizIds);
      const branchIds = (branches || []).map(b => b.id);
      const { data: lowStock } = await supabase
        .from("branch_stock")
        .select("quantity, products!inner(min_stock)")
        .in("branch_id", branchIds)
        .not("products.min_stock", "is", null);
      const alerts = (lowStock || []).filter(
        (s: any) => s.quantity <= (s.products?.min_stock || 0)
      ).length;
      return bizList.map(b => ({ id: b.id, name: b.name, business_type: b.business_type, alerts }));
    },
    enabled: !!profile?.id,
  });

  // Employments stat
  const { data: employments = [], isLoading: loadingEmp } = useQuery({
    queryKey: ["hub-emp-stat", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res: any = await (supabase.from("employees") as any)
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true);
      const data = (res.data || []) as { id: string }[];
      if (!data.length) return [];
      const empIds = data.map(e => e.id);
      const jr: any = await (supabase.from("jornadas") as any)
        .select("empleado_id")
        .in("empleado_id", empIds)
        .is("cierre_at", null);
      const jornadasData = (jr.data || []) as { empleado_id: string }[];
      return data.map(e => ({
        id: e.id,
        active: !!jornadasData.find(j => j.empleado_id === e.id),
      }));
    },
    enabled: !!user?.id,
  });

  // Affiliations stat
  const { data: affiliations = [] } = useQuery({
    queryKey: ["hub-aff-stat", profile?.email],
    queryFn: async () => {
      if (!profile?.email) return [];
      const { data } = await supabase
        .from("affiliates").select("id, points").eq("email", profile.email);
      return data || [];
    },
    enabled: !!profile?.email,
  });

  const loading = loadingOwned || loadingEmp;

  const ownedAlerts = ownedBusinesses.reduce((s, b) => s + (b.alerts || 0), 0);
  const empActive = employments.some(e => e.active);
  const totalPoints = affiliations.reduce((s, a) => s + (a.points || 0), 0);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const firstName = profile?.full_name?.split(" ")[0] || "Usuario";

  const handleOpenBusinesses = async () => {
    if (!ownedBusinesses.length) {
      setCreateBizOpen(true);
      return;
    }
    if (ownedBusinesses.length === 1) {
      const biz = ownedBusinesses[0];
      if (profile?.business_id === biz.id) {
        navigate("/dashboard");
        return;
      }
      try {
        const { data: bizBranches } = await supabase
          .from("branches").select("id").eq("business_id", biz.id).eq("is_main", true).limit(1);
        const mainBranchId = bizBranches?.[0]?.id || null;
        await supabase
          .from("profiles")
          .update({ business_id: biz.id, branch_id: mainBranchId })
          .eq("user_id", profile!.user_id);
        window.location.assign("/dashboard");
      } catch {
        toast.error("No se pudo abrir el negocio");
      }
      return;
    }
    setSelectorOpen(true);
  };

  if (loading) {
    return <AppLoader />;
  }

  return (
    <div ref={scrollRef} className="h-screen overflow-y-auto hub-bg hub-text pb-0 overflow-x-hidden">
      {/* TOPBAR — solid sidebar color */}
      <div className={`hub-topbar-solid sticky top-0 z-50 px-4 md:px-10 py-3 backdrop-blur-md transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${hideTopbar ? "-translate-y-full" : "translate-y-0"}`}>
        <div className="grid grid-cols-2 md:grid-cols-[1fr_2fr_1fr] items-center gap-3 md:gap-4">
          {/* Logo */}
          <div className="flex items-center md:order-1">
            <img
              src={isDark ? "/logo-dark.png" : "/logo-light.png"}
              alt="Bivoo"
              className="h-6 w-auto cursor-pointer"
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            />
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-1 justify-end md:order-3">
            {/* Theme switch */}
            <button
              className="flex items-center gap-1.5 px-1.5 h-8 rounded-lg hub-btn-hover cursor-pointer"
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <Moon className="h-[13px] w-[13px] hub-text-dim" /> : <Sun className="h-[13px] w-[13px] hub-text-dim" />}
              <div className={`w-[26px] h-[15px] rounded-full relative flex-shrink-0 ${isDark ? "bg-[hsl(var(--primary)/0.25)] border border-[hsl(var(--primary)/0.3)]" : "hub-switch-track"}`}>
                <div className={`absolute top-[2px] w-[9px] h-[9px] rounded-full transition-all ${isDark ? "left-[13px] bg-[hsl(var(--primary))]" : "left-[2px] hub-switch-thumb"}`} />
              </div>
            </button>

            <div className="hidden sm:block w-px h-4 hub-divider mx-1" />

            <button className="hub-icon-btn" title="Sincronización" onClick={() => setSyncOpen(true)}>
              <Cloud className="h-[15px] w-[15px]" />
            </button>

            <a
              href="https://wa.me/message/JNVHILZDVTQAH1"
              target="_blank"
              rel="noopener noreferrer"
              className="hub-icon-btn"
              title="Soporte"
            >
              <MessageSquare className="h-[15px] w-[15px]" />
            </a>

            <div className="hidden sm:block w-px h-4 hub-divider mx-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 py-[3px] px-2 pl-[3px] rounded-full border border-transparent hover:border-[var(--hub-border2)] transition-all cursor-pointer">
                  <div className="w-[26px] h-[26px] rounded-full bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] flex items-center justify-center text-[11px] font-medium text-[hsl(var(--primary))] flex-shrink-0">
                    {profile?.full_name ? getInitials(profile.full_name) : "U"}
                  </div>
                  <span className="hidden sm:inline text-xs hub-text-muted">{firstName}</span>
                  <ChevronDown className="hidden sm:inline h-[11px] w-[11px] hub-text-dim" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[176px] hub-dropdown">
                <div className="px-2.5 py-2 border-b border-[var(--hub-border)] mb-1">
                  <p className="text-[13px] hub-text">{profile?.full_name || "Usuario"}</p>
                  <p className="text-[11px] hub-text-dim mt-0.5">{profile?.email}</p>
                </div>
                <DropdownMenuItem className="gap-2 text-[13px] hub-text-muted" onClick={() => setProfileOpen(true)}>
                  <User className="h-3.5 w-3.5" /> Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-[13px] text-destructive" onClick={() => signOut()}>
                  <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Search — full row on mobile, centered on desktop */}
          <div ref={searchBoxRef} className="relative col-span-2 md:col-span-1 md:order-2">
            <div className="hub-search-box">
              <Search className="h-3.5 w-3.5 hub-text-dim flex-shrink-0" />
              <input
                className="hub-search-input"
                placeholder="Buscar negocios, servicios, productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => { if (search.trim().length >= 2) setSearchOpen(true); }}
              />
            </div>

            {searchOpen && debouncedSearch.length >= 2 && (
              <div
                className="absolute left-0 right-0 top-[calc(100%+6px)] z-[60] hub-card rounded-xl shadow-xl border border-[var(--hub-border)] max-h-[420px] overflow-y-auto"
              >
                {searchLoading && (
                  <div className="flex items-center gap-2 px-3 py-3 text-[12px] hub-text-dim">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--hub-green)" }} />
                    Buscando...
                  </div>
                )}

                {!searchLoading && businessHits.length === 0 && itemHits.length === 0 && (
                  <div className="px-3 py-4 text-[12px] hub-text-dim">
                    Sin resultados para "{debouncedSearch}"
                  </div>
                )}

                {!searchLoading && businessHits.length > 0 && (
                  <div className="py-1">
                    <div className="text-[10px] uppercase tracking-wider hub-text-dim px-3 py-1.5">Negocios</div>
                    {businessHits.map((b) => (
                      <button
                        key={`b-${b.id}`}
                        onClick={() => goToStorefront(b.business_slug)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--hub-hover)] text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] flex items-center justify-center text-[11px] font-medium text-[hsl(var(--primary))] flex-shrink-0">
                          {b.name?.[0]?.toUpperCase() || "B"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] hub-text truncate">{b.name}</div>
                          {b.business_type && (
                            <div className="text-[11px] hub-text-dim truncate">{b.business_type}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!searchLoading && itemHits.length > 0 && (
                  <div className="py-1 border-t border-[var(--hub-border)]">
                    <div className="text-[10px] uppercase tracking-wider hub-text-dim px-3 py-1.5">Productos y servicios</div>
                    {itemHits.map((it) => (
                      <button
                        key={`${it.kind}-${it.id}`}
                        onClick={() => goToStorefront(it.business_slug)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--hub-hover)] text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] hub-text truncate">{it.name}</div>
                          <div className="text-[11px] hub-text-dim truncate">· {it.business_name}</div>
                        </div>
                        {it.price != null && (
                          <div className="text-[12px] hub-text-muted font-medium flex-shrink-0 ml-2">
                            {formatPrice(it.price)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HERO ROW — greeting + stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-10 pt-5 md:pt-8 pb-7 gap-4 md:gap-6 animate-hub-fade-up">
        <div className="min-w-0">
          <h1 className="font-['Cormorant_Garamond'] text-[32px] md:text-[46px] font-normal leading-[1.05] tracking-[-0.5px]">
            ¡Hola, <em className="italic text-[hsl(var(--primary))]">{firstName}!</em>
          </h1>
          <p className="text-[13px] hub-text-dim mt-1.5">
            {ownedBusinesses.length + employments.length + affiliations.length}{" "}
            {ownedBusinesses.length + employments.length + affiliations.length === 1 ? "espacio activo" : "espacios activos"} en Bivoo
          </p>
          <div className="text-[11px] hub-text-dim mt-1 flex items-center gap-1.5">
            <MapPin className="h-[11px] w-[11px]" />
            Mostrando negocios cerca de{" "}
            <span className="hub-text-muted border-b border-dashed border-[var(--hub-text3)] cursor-pointer">
              {city || "tu ubicación"}
            </span>
            {" · "}
            <span className="cursor-pointer hover:hub-text-muted transition-colors">Cambiar</span>
          </div>
        </div>

        <div className="grid grid-cols-3 md:flex gap-2 w-full md:w-auto">
          {ownedBusinesses.length === 0 ? (
            <div
              className="hub-stat border border-dashed flex flex-col items-center justify-center cursor-pointer"
              onClick={() => setCreateBizOpen(true)}
            >
              <Plus className="h-4 w-4 mb-1" style={{ color: "var(--hub-green)" }} />
              <div className="hub-stat-label">Agregar negocio</div>
              <div className="hub-stat-sub">Comienza aquí</div>
            </div>
          ) : (
            <div className="hub-stat" onClick={handleOpenBusinesses}>
              <div className="hub-stat-n" style={{ color: "var(--hub-green)" }}>{ownedBusinesses.length}</div>
              <div className="hub-stat-label">Mis negocios</div>
              <div className="hub-stat-sub" style={{ color: ownedAlerts > 0 ? "var(--hub-red)" : "var(--hub-text3)" }}>
                {ownedAlerts > 0 ? `${ownedAlerts} alertas` : "Sin alertas"}
              </div>
            </div>
          )}

          {employments.length > 0 && (
            <div className="hub-stat" onClick={() => navigate("/mi-empleo")}>
              <div className="hub-stat-n" style={{ color: "var(--hub-purple)" }}>{employments.length}</div>
              <div className="hub-stat-label">Mi empleo</div>
              <div className="hub-stat-sub" style={{ color: empActive ? "var(--hub-green)" : "var(--hub-text3)" }}>
                {empActive ? "Activa" : "Sin jornada"}
              </div>
            </div>
          )}

          {affiliations.length > 0 && (
            <div className="hub-stat">
              <div className="hub-stat-n" style={{ color: "var(--hub-gold)" }}>{totalPoints}</div>
              <div className="hub-stat-label">Mis puntos</div>
              <div className="hub-stat-sub" style={{ color: "var(--hub-gold)" }}>
                {affiliations.length} {affiliations.length === 1 ? "afiliación" : "afiliaciones"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EDITORIAL CONTENT */}
      <HubEditorial onCreateBusiness={() => setCreateBizOpen(true)} />

      <SyncStatusModal open={syncOpen} onOpenChange={setSyncOpen} />
      <CreateBusinessModal open={createBizOpen} onOpenChange={setCreateBizOpen} />
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
      <BusinessSelectorModal
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        businesses={ownedBusinesses}
        onCreateNew={() => setCreateBizOpen(true)}
      />
    </div>
  );
};

export default Hub;

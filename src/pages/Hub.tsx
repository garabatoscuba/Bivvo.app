import { useState, useEffect } from "react";
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

const Hub = () => {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [syncOpen, setSyncOpen] = useState(false);
  const [createBizOpen, setCreateBizOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string>("");
  const isDark = theme === "dark";

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
        .select("id")
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
      return bizList.map(b => ({ id: b.id, alerts }));
    },
    enabled: !!profile?.id,
  });

  // Employments stat
  const { data: employments = [], isLoading: loadingEmp } = useQuery({
    queryKey: ["hub-emp-stat", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("employees").select("id").eq("auth_user_id", user.id).eq("is_active", true);
      if (!data?.length) return [];
      const empIds = data.map(e => e.id);
      const { data: jornadasData } = await supabase
        .from("jornadas").select("empleado_id").in("empleado_id", empIds).is("cierre_at", null);
      return data.map(e => ({
        id: e.id,
        active: !!(jornadasData || []).find(j => j.empleado_id === e.id),
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center hub-bg">
        <Loader2 className="h-6 w-6 animate-spin hub-text-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-screen hub-bg hub-text pb-0 overflow-x-hidden">
      {/* TOPBAR — solid sidebar color */}
      <div className="hub-topbar-solid sticky top-0 z-50 grid grid-cols-[1fr_2fr_1fr] items-center px-10 py-3 gap-4 backdrop-blur-md">
        {/* Logo */}
        <div
          className="font-['DM_Sans'] font-light text-xl tracking-[3px] hub-text cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          Bivo<span className="text-[hsl(var(--primary))]">o</span>
        </div>

        {/* Search centered */}
        <div className="hub-search-box">
          <Search className="h-3.5 w-3.5 hub-text-dim flex-shrink-0" />
          <input
            className="hub-search-input"
            placeholder="Buscar negocios, servicios, productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-1 justify-end">
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

          <div className="w-px h-4 hub-divider mx-1" />

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

          <div className="w-px h-4 hub-divider mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 py-[3px] px-2 pl-[3px] rounded-full border border-transparent hover:border-[var(--hub-border2)] transition-all cursor-pointer">
                <div className="w-[26px] h-[26px] rounded-full bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] flex items-center justify-center text-[11px] font-medium text-[hsl(var(--primary))] flex-shrink-0">
                  {profile?.full_name ? getInitials(profile.full_name) : "U"}
                </div>
                <span className="text-xs hub-text-muted">{firstName}</span>
                <ChevronDown className="h-[11px] w-[11px] hub-text-dim" />
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
      </div>

      {/* HERO ROW — greeting + stats */}
      <div className="flex items-center justify-between px-10 pt-8 pb-7 gap-6 animate-hub-fade-up">
        <div>
          <h1 className="font-['Cormorant_Garamond'] text-[46px] font-normal leading-[1.05] tracking-[-0.5px]">
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

        <div className="flex gap-2">
          <div className="hub-stat" onClick={() => ownedBusinesses[0] && navigate("/dashboard")}>
            <div className="hub-stat-n" style={{ color: "var(--hub-green)" }}>{ownedBusinesses.length}</div>
            <div className="hub-stat-label">Mis negocios</div>
            <div className="hub-stat-sub" style={{ color: ownedAlerts > 0 ? "var(--hub-red)" : "var(--hub-text3)" }}>
              {ownedAlerts > 0 ? `${ownedAlerts} alertas` : "Sin alertas"}
            </div>
          </div>
          <div className="hub-stat" onClick={() => employments.length && navigate("/mi-empleo")}>
            <div className="hub-stat-n" style={{ color: "var(--hub-purple)" }}>{employments.length}</div>
            <div className="hub-stat-label">Mi empleo</div>
            <div className="hub-stat-sub" style={{ color: empActive ? "var(--hub-green)" : "var(--hub-text3)" }}>
              {empActive ? "Activa" : "Sin jornada"}
            </div>
          </div>
          <div className="hub-stat">
            <div className="hub-stat-n" style={{ color: "var(--hub-gold)" }}>{totalPoints}</div>
            <div className="hub-stat-label">Mis puntos</div>
            <div className="hub-stat-sub" style={{ color: "var(--hub-gold)" }}>
              {affiliations.length} {affiliations.length === 1 ? "afiliación" : "afiliaciones"}
            </div>
          </div>
        </div>
      </div>

      {/* EDITORIAL CONTENT */}
      <HubEditorial onCreateBusiness={() => setCreateBizOpen(true)} />

      <SyncStatusModal open={syncOpen} onOpenChange={setSyncOpen} />
      <CreateBusinessModal open={createBizOpen} onOpenChange={setCreateBizOpen} />
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
};

export default Hub;

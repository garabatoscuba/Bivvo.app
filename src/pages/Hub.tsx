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
  Settings,
  User,
  Home,
  Briefcase,
  Star,
  Check,
  Plus,
  Loader2,
} from "lucide-react";

const Hub = () => {
  const navigate = useNavigate();
  const { profile, user, signOut, switchBranch } = useAuth();
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const isDark = theme === "dark";
  const redirectedRef = useRef(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fetch owned businesses with branch count
  const { data: ownedBusinesses = [], isLoading: loadingOwned } = useQuery({
    queryKey: ["hub-owned-businesses", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data: bizList } = await supabase
        .from("businesses")
        .select("id, name, business_type, slug")
        .eq("owner_id", profile.id)
        .eq("is_active", true)
        .order("created_at");
      if (!bizList?.length) return [];

      const bizIds = bizList.map((b) => b.id);
      const { data: allBranches } = await supabase
        .from("branches")
        .select("id, business_id, is_main")
        .in("business_id", bizIds);

      // Fetch alerts: low stock + pending orders
      const { data: lowStock } = await supabase
        .from("branch_stock")
        .select("branch_id, product_id, quantity, products!inner(name, min_stock)")
        .in("branch_id", (allBranches || []).map(b => b.id))
        .not("products.min_stock", "is", null);

      return bizList.map((biz) => {
        const branches = (allBranches || []).filter((br) => br.business_id === biz.id);
        const branchIds = branches.map(b => b.id);
        const mainBranch = branches.find(b => b.is_main) || branches[0];

        // Count low stock alerts
        const lowStockItems = (lowStock || []).filter(
          (s) => branchIds.includes(s.branch_id) && s.quantity <= ((s as any).products?.min_stock || 0)
        );

        return {
          ...biz,
          branchCount: branches.length,
          mainBranchId: mainBranch?.id || null,
          alerts: {
            lowStock: lowStockItems.length,
          },
        };
      });
    },
    enabled: !!profile?.id,
  });

  // Fetch employments
  const { data: employments = [], isLoading: loadingEmp } = useQuery({
    queryKey: ["hub-employments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const query = supabase.from("employees").select("id, business_id, branch_id, position");
      const res = await (query as any).eq("auth_user_id", user.id).eq("is_active", true);
      const data = res.data as { id: string; business_id: string; branch_id: string | null; position: string | null }[] | null;
      if (!data?.length) return [];

      // Fetch business + branch names separately to avoid deep type issues
      const bizIds = [...new Set(data.map(e => e.business_id))];
      const branchIds = data.map(e => e.branch_id).filter(Boolean) as string[];
      const [bizRes, branchRes] = await Promise.all([
        supabase.from("businesses").select("id, name, business_type, slug").in("id", bizIds),
        branchIds.length ? supabase.from("branches").select("id, name").in("id", branchIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const bizMap = new Map((bizRes.data || []).map(b => [b.id, b]));
      const branchMap = new Map((branchRes.data || []).map(b => [b.id, b]));

      // Check active jornadas — uses empleado_id (profile id, not employee id)
      // jornadas references profiles, so we need to map employee→profile
      const empIds = data.map((e) => e.id);
      const { data: jornadasData } = await supabase
        .from("jornadas")
        .select("id, empleado_id, apertura_at")
        .in("empleado_id", empIds)
        .is("cierre_at", null);

      return data.map((emp) => {
        const biz = bizMap.get(emp.business_id);
        const branch = emp.branch_id ? branchMap.get(emp.branch_id) : null;
        const jornada = (jornadasData || []).find((j) => j.empleado_id === emp.id);
        const elapsed = jornada ? Math.floor((Date.now() - new Date(jornada.apertura_at).getTime()) / 60000) : 0;
        const hours = Math.floor(elapsed / 60);
        const mins = elapsed % 60;
        return {
          id: emp.id,
          business_id: emp.business_id,
          branch_id: emp.branch_id,
          position: emp.position,
          businessName: biz?.name || "Negocio",
          businessType: biz?.business_type || "",
          branchName: branch?.name || "",
          jornadaActiva: !!jornada,
          jornadaTime: jornada ? `${hours}h ${mins}m` : null,
        };
      });
    },
    enabled: !!user?.id,
  });

  // Fetch affiliations
  const { data: affiliations = [], isLoading: loadingAff } = useQuery({
    queryKey: ["hub-affiliations", profile?.email],
    queryFn: async () => {
      if (!profile?.email) return [];
      const { data } = await supabase
        .from("affiliates")
        .select("id, points, created_at, branch_id, branches!affiliates_branch_id_fkey(name, business_id, businesses!branches_business_id_fkey(name, slug))")
        .eq("email", profile.email);
      if (!data?.length) return [];
      return data.map((a, i) => ({
        id: a.id,
        points: a.points,
        createdAt: a.created_at,
        businessName: (a as any).branches?.businesses?.name || "Negocio",
        businessSlug: (a as any).branches?.businesses?.slug || "",
        color: i % 2 === 0 ? "gold" : "blue",
      }));
    },
    enabled: !!profile?.email,
  });

  // Auto-redirect if single context
  const loading = loadingOwned || loadingEmp;
  useEffect(() => {
    if (loading || redirectedRef.current) return;
    const total = ownedBusinesses.length + employments.length;
    if (total === 1) {
      redirectedRef.current = true;
      if (ownedBusinesses.length === 1) {
        const biz = ownedBusinesses[0];
        if (biz.mainBranchId) {
          switchBranch(biz.mainBranchId).then(() => navigate("/dashboard", { replace: true }));
        } else {
          navigate("/dashboard", { replace: true });
        }
      } else if (employments.length === 1) {
        navigate("/mi-empleo", { replace: true });
      }
    }
  }, [loading, ownedBusinesses, employments, navigate, switchBranch]);

  const handleBusinessClick = async (biz: typeof ownedBusinesses[0]) => {
    if (biz.mainBranchId) {
      await switchBranch(biz.mainBranchId);
    }
    // Update profile business_id too
    if (profile?.user_id) {
      await supabase.from("profiles").update({ business_id: biz.id, branch_id: biz.mainBranchId }).eq("user_id", profile.user_id);
    }
    navigate("/dashboard");
  };

  const handleEmploymentClick = (emp: typeof employments[0]) => {
    navigate("/mi-empleo");
  };

  const handleAffiliationClick = (aff: typeof affiliations[0]) => {
    if (aff.businessSlug) {
      navigate(`/s/${aff.businessSlug}`);
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const firstName = profile?.full_name?.split(" ")[0] || "Usuario";
  const totalContexts = ownedBusinesses.length + employments.length + affiliations.length;

  const businessTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      store: "Tienda",
      "copy_shop": "Punto de copias",
      "estaurente/safetería": "Restaurante",
      gym: "Gimnasio",
    };
    return map[type] || type;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center hub-bg">
        <Loader2 className="h-6 w-6 animate-spin hub-text-muted" />
      </div>
    );
  }

  // If auto-redirecting, show nothing
  if (redirectedRef.current) return null;

  return (
    <div className="min-h-screen hub-bg hub-text pb-20 overflow-x-hidden">
      {/* TOPBAR */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 px-6 h-14 flex items-center justify-between transition-all duration-300 ${
          scrolled ? "hub-topbar-scrolled" : "bg-transparent border-b border-transparent"
        }`}
      >
        <img
          src={isDark ? "/logo-dark.png" : "/logo-light.png"}
          alt="Bivoo"
          className="h-6 w-auto cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />

        <div className="flex items-center gap-0.5">
          {/* Theme switch */}
          <button
            className="flex items-center gap-1.5 px-2 h-[34px] rounded-[9px] hub-btn-hover cursor-pointer"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <Moon className="h-[13px] w-[13px] hub-text-dim" /> : <Sun className="h-[13px] w-[13px] hub-text-dim" />}
            <div className={`w-[26px] h-[15px] rounded-full relative transition-colors duration-250 flex-shrink-0 ${isDark ? "bg-[hsl(var(--primary)/0.25)] border border-[hsl(var(--primary)/0.3)]" : "hub-switch-track"}`}>
              <div className={`absolute top-[2px] w-[9px] h-[9px] rounded-full transition-all duration-250 ${isDark ? "left-[13px] bg-[hsl(var(--primary))]" : "left-[2px] hub-switch-thumb"}`} />
            </div>
          </button>

          <div className="w-px h-4 hub-divider mx-1.5" />

          {/* Cloud / Sync */}
          <button className="hub-icon-btn" title="Sincronización" onClick={() => setSyncOpen(true)}>
            <Cloud className="h-[15px] w-[15px]" />
          </button>

          {/* Support */}
          <a href="https://wa.me/message/JNVHILZDVTQAH1" target="_blank" rel="noopener noreferrer" className="hub-icon-btn" title="Soporte">
            <MessageSquare className="h-[15px] w-[15px]" />
          </a>

          <div className="w-px h-4 hub-divider mx-1.5" />

          {/* Avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-[7px] py-[3px] px-2 pl-[3px] rounded-full border border-transparent hover:border-[var(--hub-border2)] hover:bg-[var(--hub-hover)] transition-all cursor-pointer">
                <div className="w-7 h-7 rounded-full bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] flex items-center justify-center text-[11px] font-medium text-[hsl(var(--primary))] flex-shrink-0">
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
              <DropdownMenuItem className="gap-2 text-[13px] hub-text-muted" onClick={() => navigate("/settings")}>
                <User className="h-3.5 w-3.5" /> Mi perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-[13px] hub-text-muted" onClick={() => navigate("/settings")}>
                <Settings className="h-3.5 w-3.5" /> Configuración
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-[13px] text-destructive" onClick={() => signOut()}>
                <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-[960px] mx-auto px-6">
        {/* Greeting */}
        <div className="pt-20 pb-9 animate-hub-fade-up">
          <h1 className="font-['Cormorant_Garamond'] text-[clamp(38px,5vw,54px)] font-normal leading-[1.1] tracking-[-0.5px]">
            ¡Hola, <em className="italic text-[hsl(var(--primary))]">{firstName}!</em>
          </h1>
          <p className="text-[13px] hub-text-muted mt-1.5">
            {totalContexts} {totalContexts === 1 ? "espacio activo" : "espacios activos"} en Bivoo
          </p>
        </div>

        {/* MIS NEGOCIOS */}
        {(ownedBusinesses.length > 0 || true) && (
          <div className="mb-9 animate-hub-fade-up hub-stagger-1">
            <div className="text-[10px] tracking-[0.15em] uppercase hub-text-dim mb-3.5 flex items-center gap-3">
              Mis negocios
              <span className="flex-1 h-px hub-line" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
              {ownedBusinesses.map((biz) => (
                <div
                  key={biz.id}
                  className="hub-card hub-card-green"
                  onClick={() => handleBusinessClick(biz)}
                >
                  <div className="hub-card-arrow">›</div>
                  <div className="hub-card-icon hub-card-icon-green">
                    <Home className="h-4 w-4" />
                  </div>
                  <div className="font-['Cormorant_Garamond'] text-[19px] font-medium leading-[1.2] mb-0.5">{biz.name}</div>
                  <div className="text-[11px] hub-text-muted mb-3.5">
                    {businessTypeLabel(biz.business_type)} · {biz.branchCount} {biz.branchCount === 1 ? "sucursal" : "sucursales"}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {biz.alerts.lowStock > 0 && (
                      <div className="flex items-center gap-[7px] text-[11px]">
                        <div className="w-[5px] h-[5px] rounded-full bg-[var(--hub-amber)] flex-shrink-0" />
                        <span className="text-[var(--hub-amber)]">{biz.alerts.lowStock} producto{biz.alerts.lowStock > 1 ? "s" : ""} con stock bajo</span>
                      </div>
                    )}
                    {biz.alerts.lowStock === 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] hub-text-muted">
                        <Check className="h-[11px] w-[11px]" /> Sin alertas
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div
                className="hub-new-card"
                onClick={() => navigate("/plans")}
              >
                <div className="hub-plus-circle">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                <span className="text-[12px] hub-text-dim">Crear negocio</span>
              </div>
            </div>
          </div>
        )}

        {/* DONDE TRABAJO */}
        {employments.length > 0 && (
          <div className="mb-9 animate-hub-fade-up hub-stagger-2">
            <div className="text-[10px] tracking-[0.15em] uppercase hub-text-dim mb-3.5 flex items-center gap-3">
              Donde trabajo
              <span className="flex-1 h-px hub-line" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
              {employments.map((emp) => (
                <div
                  key={emp.id}
                  className={`hub-card hub-card-purple ${emp.jornadaActiva ? "hub-card-emp-active" : ""}`}
                  onClick={() => handleEmploymentClick(emp)}
                >
                  <div className="hub-card-arrow">›</div>
                  <div className="hub-card-icon hub-card-icon-purple">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div className="font-['Cormorant_Garamond'] text-[19px] font-medium leading-[1.2] mb-0.5">{emp.businessName}</div>
                  <div className="text-[11px] hub-text-muted mb-3.5">
                    {emp.position || "Empleado"} · {emp.branchName}
                  </div>
                  {emp.jornadaActiva && (
                    <div className="flex items-center gap-[7px] text-[12px] text-[hsl(var(--primary))] mt-2.5">
                      <div className="hub-live-dot" />
                      Jornada activa · {emp.jornadaTime}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MIS AFILIACIONES */}
        {affiliations.length > 0 && (
          <div className="mb-9 animate-hub-fade-up hub-stagger-3">
            <div className="text-[10px] tracking-[0.15em] uppercase hub-text-dim mb-3.5 flex items-center gap-3">
              Mis afiliaciones
              <span className="flex-1 h-px hub-line" />
            </div>
            <div className="flex flex-col gap-px">
              {affiliations.map((aff) => (
                <div
                  key={aff.id}
                  className={`hub-feed-item ${aff.color === "gold" ? "hub-feed-gold" : "hub-feed-blue"}`}
                  onClick={() => handleAffiliationClick(aff)}
                >
                  <div className={`hub-feed-icon ${aff.color === "gold" ? "hub-feed-icon-gold" : "hub-feed-icon-blue"}`}>
                    <Star className="h-[15px] w-[15px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] hub-text">{aff.businessName}</div>
                    <div className="text-[11px] hub-text-dim mt-0.5">
                      Afiliado desde {formatDate(aff.createdAt)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`font-['Cormorant_Garamond'] text-[22px] font-medium leading-none ${aff.color === "gold" ? "text-[var(--hub-gold)]" : "text-[var(--hub-blue)]"}`}>
                      {aff.points}
                    </div>
                    <div className="text-[10px] hub-text-dim mt-px">pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <SyncStatusModal open={syncOpen} onOpenChange={setSyncOpen} />
    </div>
  );
};

export default Hub;

import { useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import { useSubscription } from "@/hooks/useSubscription";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Package,
  ShoppingCart,
  Receipt,
  Users,
  Settings,
  Shield,
  LogOut,
  CreditCard,
  Download,
  Store,
  ChevronDown,
  Dumbbell,
  Check,
  Settings2,
  Sun,
  Moon,
  ShoppingBag,
  Plus,
  MapPin,
  Pencil,
  Wrench,
  DollarSign,
  Briefcase,
  FileText,
  Bot,
  Tag,
  Network,
  ChefHat,
} from "lucide-react";
import { getIconComponent } from "@/components/services/IconSelector";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useJornadaActiva } from "@/hooks/useJornadaActiva";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const AppSidebar = () => {
  const { settings: storeSettings } = useStoreSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isSuperAdmin, isOwner, isManager, signOut, switchBranch, isCuba, isPartner } = useAuth();
  const { data: branches = [] } = useBranches();
  const { planType } = useSubscription();
  const { isInstalled } = usePWAInstall();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  const [newBizOpen, setNewBizOpen] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizType, setBizType] = useState("store");
  const [editBizOpen, setEditBizOpen] = useState(false);
  const [editBizId, setEditBizId] = useState("");
  const [editBizName, setEditBizName] = useState("");

  // Branch dialog state
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<{
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
  } | null>(null);
  const [branchBizId, setBranchBizId] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");

  const activeBranch = branches.find((b) => b.id === profile?.branch_id);
  const isBivooAccount = profile?.email?.toLowerCase().endsWith("@bivoo.app") || false;

  const normalizeEmployeePosition = (position?: string | null): "manager" | "seller" | "accountant" | "cocina" | null => {
    const raw = position?.toLowerCase().trim();
    if (!raw) return null;
    if (["manager", "gerente"].includes(raw)) return "manager";
    if (["accountant", "contable"].includes(raw)) return "accountant";
    if (["seller", "vendedor", "dependiente", "dependent"].includes(raw)) return "seller";
    if (["cocina", "cocinero", "kitchen", "chef"].includes(raw)) return "cocina";
    return null;
  };

  // Resolve employee context strictly by auth.uid -> employees.auth_user_id
  const { data: employeeRecord = null, isLoading: employeeRecordLoading } = useQuery({
    queryKey: ["employee-session-record", profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("id, business_id, branch_id, position, businesses!employees_business_id_fkey(name, business_type)")
        .eq("auth_user_id", profile.user_id)
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    },
    enabled: !!profile?.user_id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const hasEmployeeRecord = !!employeeRecord;
  const employeeBusinessId = (employeeRecord as any)?.business_id ?? null;
  const employerName = (employeeRecord as any)?.businesses?.name || null;
  const employeePosition = normalizeEmployeePosition((employeeRecord as any)?.position);
  const isEmployeeSession = hasEmployeeRecord;
  const isEmployeeManager = employeePosition === "manager";
  const isEmployeeKitchen = employeePosition === "cocina";
  const shouldWaitEmployeeResolution = isBivooAccount && employeeRecordLoading;

  // Employees must not run owner/owner_id sidebar flow
  const showBusinessSection = !shouldWaitEmployeeResolution && (isOwner || isSuperAdmin) && !isEmployeeSession;

  // Managers use their employee role in real-time (not cached owner flags)
  const showManagerModules =
    !shouldWaitEmployeeResolution && (isEmployeeSession ? isEmployeeManager : isManager && !isOwner && !isSuperAdmin);

  // Kitchen staff only sees cocina — restricted to restaurant/cafetería business types
  const isRestaurantBusiness = (employeeRecord as any)?.businesses?.business_type === 'estaurente/safetería';
  const showKitchenModule = !shouldWaitEmployeeResolution && isEmployeeSession && isEmployeeKitchen && isRestaurantBusiness;

  // Jornada check for operational employee tools
  const { jornadaActiva } = useJornadaActiva();
  const showEmployeeTools = !shouldWaitEmployeeResolution && isEmployeeSession && !isEmployeeManager && !isEmployeeKitchen && jornadaActiva;

  // Fetch user's businesses with their branches
  const { data: userBusinesses = [] } = useQuery({
    queryKey: ["user-businesses-with-branches", profile?.user_id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data: bizList } = await supabase
        .from("businesses")
        .select("id, name, business_type")
        .eq("owner_id", profile.id)
        .order("created_at");
      if (!bizList) return [];

      // Fetch branches for all businesses
      const bizIds = bizList.map((b) => b.id);
      const { data: allBranches } = await supabase
        .from("branches")
        .select("id, name, business_id, is_main, address, phone")
        .in("business_id", bizIds)
        .order("is_main", { ascending: false })
        .order("name");

      return bizList.map((biz) => ({
        ...biz,
        branches: (allBranches || []).filter((br) => br.business_id === biz.id),
      }));
    },
    enabled: !!profile?.id && !isBivooAccount && !isEmployeeSession,
  });

  const createBizMutation = useMutation({
    mutationFn: async ({ name, business_type }: { name: string; business_type: string }) => {
      const { error } = await supabase.from("business_requests").insert({
        user_id: profile!.user_id,
        request_type: "business",
        business_name: name,
        business_type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-businesses-with-branches"] });
      toast({
        title: "Solicitud enviada",
        description: "Tu solicitud de nuevo negocio está pendiente de aprobación por el administrador.",
      });
      setNewBizOpen(false);
      setBizName("");
      setBizType("store");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateBizMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("businesses").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-businesses-with-branches"] });
      toast({ title: "Negocio actualizado" });
      setEditBizOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const branchMutation = useMutation({
    mutationFn: async () => {
      if (editingBranch) {
        // Editing existing branch - direct update (allowed)
        const { error } = await supabase
          .from("branches")
          .update({
            name: branchName.trim(),
            address: branchAddress.trim() || null,
            phone: branchPhone.trim() || null,
          })
          .eq("id", editingBranch.id);
        if (error) throw error;
      } else {
        // Creating new branch - submit request for approval
        const { error } = await supabase.from("business_requests").insert({
          user_id: profile!.user_id,
          request_type: "branch",
          branch_name: branchName.trim(),
          branch_business_id: branchBizId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-businesses-with-branches"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast({
        title: editingBranch ? "Sucursal actualizada" : "Solicitud enviada",
        description: editingBranch ? undefined : "Tu solicitud de nueva sucursal está pendiente de aprobación.",
      });
      setBranchDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const switchBusiness = async (bizId: string) => {
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
      .eq("user_id", profile!.user_id);
    window.location.reload();
  };

  const handleSelectBranch = async (branchId: string) => {
    try {
      await switchBranch(branchId);
      queryClient.invalidateQueries();
      toast({ title: "Sucursal activa cambiada" });
    } catch {
      toast({ title: "Error al cambiar de sucursal", variant: "destructive" });
    }
  };

  const handleAddBusiness = (type: "store" | "gym") => {
    if (type === "gym") return;
    if (planType === "free") {
      navigate("/plans");
      return;
    }
    setNewBizOpen(true);
  };

  const openEditBiz = (biz: { id: string; name: string }) => {
    setEditBizId(biz.id);
    setEditBizName(biz.name);
    setEditBizOpen(true);
  };

  const openCreateBranch = (bizId: string) => {
    setEditingBranch(null);
    setBranchBizId(bizId);
    setBranchName("");
    setBranchAddress("");
    setBranchPhone("");
    setBranchDialogOpen(true);
  };

  const openEditBranch = (branch: { id: string; name: string; address: string | null; phone: string | null }) => {
    setEditingBranch(branch);
    setBranchName(branch.name);
    setBranchAddress(branch.address || "");
    setBranchPhone(branch.phone || "");
    setBranchDialogOpen(true);
  };

  const superAdminItems = [
    { title: "Resumen", url: "/admin", icon: Shield },
    { title: "Usuarios", url: "/admin/users", icon: Users },
    { title: "Negocios", url: "/admin/businesses", icon: Store },
    { title: "Ofertas", url: "/admin/offers", icon: Tag },
    { title: "Módulos y Plugins", url: "/admin/modules", icon: Settings2 },
    { title: "Partners", url: "/admin/partners", icon: Network },
    { title: "Asistente IA", url: "/admin/assistant", icon: Bot },
  ];

  const activeBusiness = showBusinessSection ? userBusinesses.find((b) => b.id === profile?.business_id) : null;

  // Owners resolve business by owner context; employees always by employees.business_id
  const resolvedBusinessId = shouldWaitEmployeeResolution
    ? null
    : isEmployeeSession
      ? employeeBusinessId
      : activeBusiness?.id || profile?.business_id;

  const { data: managerBusiness = null } = useQuery({
    queryKey: ["manager-business-type", resolvedBusinessId],
    queryFn: async () => {
      if (!resolvedBusinessId) return null;
      const { data } = await supabase
        .from("businesses")
        .select("id, name, business_type")
        .eq("id", resolvedBusinessId)
        .maybeSingle();
      return data;
    },
    enabled: !!resolvedBusinessId && (!activeBusiness || isEmployeeSession || showManagerModules),
  });

  // Use owner's business or fallback to resolved employee/manager business
  const resolvedBusiness = activeBusiness || managerBusiness || (employeeRecord as any)?.businesses || null;

  // Fetch dynamic sidebar modules filtered by pricing availability
  const { data: sidebarModules = [] } = useQuery({
    queryKey: ["sidebar-modules", resolvedBusiness?.business_type, planType],
    queryFn: async () => {
      if (!resolvedBusiness?.business_type) return [];
      const { data: btConfig } = await supabase
        .from("business_type_configs")
        .select("module_ids")
        .eq("key", resolvedBusiness.business_type)
        .eq("is_active", true)
        .maybeSingle();
      if (!btConfig?.module_ids?.length) return [];
      const { data: mods } = await supabase
        .from("platform_modules")
        .select("id, name, sidebar_label, icon")
        .in("id", btConfig.module_ids)
        .eq("is_active", true)
        .order("sort_order");
      if (!mods?.length) return [];

      // Filter by pricing availability for the current plan
      const { data: pricing } = await supabase
        .from("module_plugin_pricing")
        .select("entity_id, availability")
        .eq("entity_type", "module")
        .eq("plan_type", planType);

      const pricingMap = new Map((pricing || []).map(p => [p.entity_id, p.availability]));

      return mods.filter(m => {
        const avail = pricingMap.get(m.id);
        // Exclude modules explicitly marked as unavailable for this plan
        return avail !== 'unavailable' && avail !== 'not_available';
      });
    },
    enabled: !!resolvedBusiness?.business_type,
  });

  // Fetch available business types for "new business" dropdown/dialog
  const { data: availableBusinessTypes = [] } = useQuery({
    queryKey: ["available-business-types", isCuba],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_type_configs")
        .select("key, name, icon, country")
        .eq("is_active", true)
        .order("sort_order");
      return (data || []).filter((bt) => (!bt.country || bt.country === "cuba" ? isCuba : true));
    },
  });

  const moduleUrlMap: Record<string, string> = {
    Dashboard: "/",
    Inventario: "/inventory",
    "Punto de Venta": "/pos",
    Servicios: "/services",
    Ventas: "/sales",
    Reportes: "/cobros",
    Portal: "/store-settings",
    Pedidos: "/orders",
    "Recursos Humanos": "/employees",
    Nómina: "/nomina",
    Caja: "/caja",
    Tesorería: "/tesoreria",
    Contabilidad: "/contabilidad",
    Impresiones: "/impresiones",
  };

  // Owner sees both Tesorería and Caja as separate sidebar items
  const ownerFilteredModules = sidebarModules;

  const isOwnerRestaurant = resolvedBusiness?.business_type === 'estaurente/safetería';

  const businessItems = [
    ...ownerFilteredModules.map((m) => ({
      title: m.sidebar_label,
      url: moduleUrlMap[m.name] || "/",
      icon: getIconComponent(m.icon),
    })),
    // Cocina (KDS) only for restaurant owners
    ...(isOwnerRestaurant ? [{ title: "Cocina (KDS)", url: "/cocina", icon: ChefHat }] : []),
    { title: "Configuración", url: "/settings", icon: Settings },
    ...(!isManager || isOwner || isSuperAdmin ? [{ title: "Planes", url: "/plans", icon: CreditCard }] : []),
  ];

  // Manager-allowed module names
  const MANAGER_ALLOWED_MODULES = new Set([
    "Punto de Venta", "Servicios", "Caja", "Inventario",
    "Pedidos", "Reportes", "Recursos Humanos", "Ventas", "Impresiones",
  ]);
  // Modules the manager can see WITHOUT an active jornada (only Empleados)
  const MANAGER_NO_JORNADA_MODULES = new Set(["Recursos Humanos"]);

  const managerDynamicModules = sidebarModules
    .filter((m) => {
      if (!MANAGER_ALLOWED_MODULES.has(m.name)) return false;
      if (m.name === "Tesorería") return false;
      if (!jornadaActiva && !MANAGER_NO_JORNADA_MODULES.has(m.name)) return false;
      return true;
    })
    .map((m) => ({
      title: m.sidebar_label,
      url: moduleUrlMap[m.name] || "/",
      icon: getIconComponent(m.icon),
    }));

  // Seller-allowed module names
  const SELLER_ALLOWED_MODULES = new Set([
    "Punto de Venta", "Servicios", "Caja", "Ventas", "Impresiones",
  ]);

  // Helper to resolve icon from sidebarModules by module name, with fallback
  const getModuleIcon = (moduleName: string, fallback: React.ComponentType<any>) => {
    const mod = sidebarModules.find((m) => m.name === moduleName);
    return mod ? getIconComponent(mod.icon) : fallback;
  };

  const sellerDynamicModules = sidebarModules
    .filter((m) => SELLER_ALLOWED_MODULES.has(m.name))
    .map((m) => ({
      title: m.sidebar_label,
      url: moduleUrlMap[m.name] || "/",
      icon: getIconComponent(m.icon),
      name: m.name,
    }));

  const ctxParam = new URLSearchParams(location.search).get("ctx");
  const isActive = (url: string) => {
    // If viewing in employee context (?ctx=emp), don't highlight the business menu items for overlapping paths
    if (ctxParam === "emp" && (url === "/pos" || url === "/sales" || url === "/services" || url === "/cobros" || url === "/caja")) {
      return false;
    }
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isDark = theme === "dark";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center">
          <img src={isDark ? "/logo-dark.png" : "/logo-light.png"} alt="Bivoo" className="h-6 w-auto" />
        </Link>
      </SidebarHeader>

      <Separator className="mx-4 w-auto" />

      <SidebarContent className="pt-2">
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Mi Empleo section - employee tools */}
        {hasEmployeeRecord && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 flex flex-col items-start leading-tight py-2 h-auto">
              <span>Mi Empleo</span>
              {employerName && (
                <span className="text-[9px] normal-case tracking-normal text-muted-foreground/50 font-normal">
                  {employerName}
                </span>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/mi-empleo")}>
                    <Link to="/mi-empleo">
                      <Briefcase className="h-4 w-4" />
                      <span className="text-sm">Mi Empleo</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {/* Operational tools for seller/dependent only when jornada is active */}
                {showEmployeeTools && sellerDynamicModules.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        location.pathname === item.url && new URLSearchParams(location.search).get("ctx") === "emp"
                      }
                    >
                      <Link to={`${item.url}?ctx=emp`}>
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Cocina section - kitchen staff only */}
        {showKitchenModule && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 flex flex-col items-start leading-tight py-2 h-auto">
              <span>Cocina</span>
              {employerName && (
                <span className="text-[9px] normal-case tracking-normal text-muted-foreground/50 font-normal">
                  {employerName}
                </span>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/mi-empleo")}>
                    <Link to="/mi-empleo">
                      <Briefcase className="h-4 w-4" />
                      <span className="text-sm">Mi Empleo</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/cocina")}>
                    <Link to="/cocina">
                      <ChefHat className="h-4 w-4" />
                      <span className="text-sm">Pedidos</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Manager modules section — sees dynamic modules + config, but NOT Planes/Mis Negocios */}
        {showManagerModules && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 flex flex-col items-start leading-tight py-2 h-auto">
              <span>Gestión</span>
              {resolvedBusiness?.name && (
                <span className="text-[9px] normal-case tracking-normal text-muted-foreground/50 font-normal">
                  {resolvedBusiness.name}
                </span>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {managerDynamicModules.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Mis Negocios - owner's businesses (hidden for managers, pure sellers and @bivoo.app) */}
        {showBusinessSection && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 flex flex-col items-start leading-tight py-2 h-auto">
              <span>{activeBusiness?.name || "Mi Negocio"}</span>
              {activeBusiness?.business_type && (
                <span className="text-[9px] normal-case tracking-normal text-muted-foreground/50 font-normal">
                  {activeBusiness.business_type === "store"
                    ? "Tienda"
                    : activeBusiness.business_type === "copy_shop"
                      ? "Punto de Copias"
                      : activeBusiness.business_type === "gym"
                        ? "Gym"
                        : activeBusiness.business_type === "estaurente/safetería"
                          ? "Restaurante / Cafetería"
                          : activeBusiness.business_type}
                </span>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Business menu items for the ACTIVE owned business */}
                {businessItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* Business selector dropdown */}
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton className="justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4" />
                          <span className="text-sm">Mis Negocios</span>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72 max-h-[70vh] overflow-y-auto">
                      {userBusinesses.length > 0 ? (
                        userBusinesses.map((biz) => {
                          const isSelectedBiz = profile?.business_id === biz.id;
                          return (
                            <div key={biz.id}>
                              {/* Business header row */}
                              <DropdownMenuItem
                                className="gap-2 justify-between"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  if (!isSelectedBiz) switchBusiness(biz.id);
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {isSelectedBiz ? (
                                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                  ) : (
                                    <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className={`truncate text-sm ${isSelectedBiz ? "font-semibold" : ""}`}>
                                      {biz.name}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground/60">
                                      {biz.business_type === "store"
                                        ? "Tienda"
                                        : biz.business_type === "copy_shop"
                                          ? "Punto de Copias"
                                          : biz.business_type === "gym"
                                            ? "Gym"
                                            : biz.business_type === "estaurente/safetería"
                                              ? "Restaurante / Cafetería"
                                              : biz.business_type}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    className="p-1 rounded hover:bg-muted"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCreateBranch(biz.id);
                                    }}
                                    title="Nueva sucursal"
                                  >
                                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                  <button
                                    className="p-1 rounded hover:bg-muted"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditBiz(biz);
                                    }}
                                    title="Editar negocio"
                                  >
                                    <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                </div>
                              </DropdownMenuItem>

                              {/* Branches under this business */}
                              {biz.branches.length > 0 && (
                                <div className="ml-4 border-l border-border/50 pl-2 my-0.5">
                                  {biz.branches.map((branch) => {
                                    const isBranchActive = profile?.branch_id === branch.id && isSelectedBiz;
                                    return (
                                      <DropdownMenuItem
                                        key={branch.id}
                                        className="gap-2 justify-between py-1.5 text-xs"
                                        onSelect={(e) => {
                                          e.preventDefault();
                                          if (!isSelectedBiz) {
                                            switchBusiness(biz.id);
                                          } else if (!isBranchActive) {
                                            handleSelectBranch(branch.id);
                                          }
                                        }}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {isBranchActive ? (
                                            <Check className="h-3 w-3 text-primary shrink-0" />
                                          ) : (
                                            <MapPin className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                          )}
                                          <span
                                            className={`truncate ${isBranchActive ? "font-medium text-foreground" : "text-muted-foreground"}`}
                                          >
                                            {branch.name}
                                          </span>
                                          {branch.is_main && (
                                            <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider shrink-0">
                                              principal
                                            </span>
                                          )}
                                        </div>
                                        <button
                                          className="p-0.5 rounded hover:bg-muted shrink-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openEditBranch(branch);
                                          }}
                                          title="Editar sucursal"
                                        >
                                          <Pencil className="h-3 w-3 text-muted-foreground/60" />
                                        </button>
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </div>
                              )}

                              <DropdownMenuSeparator className="my-1" />
                            </div>
                          );
                        })
                      ) : (
                        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                          Sin negocios
                        </DropdownMenuItem>
                      )}
                      {availableBusinessTypes.map((bt) => (
                        <DropdownMenuItem
                          key={bt.key}
                          className="gap-2"
                          onSelect={() => {
                            setBizType(bt.key);
                            setNewBizOpen(true);
                          }}
                        >
                          <Store className="h-3.5 w-3.5" />
                          <span>{bt.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Partner section — only visible to users with partner role */}
        {isPartner && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Partner
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/mi-red")}>
                    <Link to="/mi-red">
                      <Network className="h-4 w-4" />
                      <span className="text-sm">Mi Red</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isInstalled && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/install")}>
                    <Link to="/install">
                      <Download className="h-4 w-4" />
                      <span className="text-sm">Descargar App</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60 p-3 space-y-3">
        {/* Theme toggle */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            <span className="text-xs">{isDark ? "Oscuro" : "Claro"}</span>
          </div>
          <Switch
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            className="scale-75"
          />
        </div>

        <Separator />

        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {profile?.full_name ? getInitials(profile.full_name) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium leading-tight">{profile?.full_name || "Usuario"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{profile?.email}</p>
            {activeBranch && (
              <p className="truncate text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                {activeBranch.name}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={signOut} title="Cerrar sesión">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>

      {/* Create Business Dialog */}
      <Dialog open={newBizOpen} onOpenChange={setNewBizOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo Negocio</DialogTitle>
            <DialogDescription>
              Al agregar un nuevo negocio se añadirá un cargo adicional a tu cuenta según tu plan activo. El monto de tu
              suscripción aumentará proporcionalmente. Espera la confirmación del administrador antes de poder
              utilizarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre del negocio</Label>
              <Input placeholder="Ej: Mi Tienda" value={bizName} onChange={(e) => setBizName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo de negocio</Label>
              <select
                value={bizType}
                onChange={(e) => setBizType(e.target.value)}
                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {availableBusinessTypes.map((bt) => (
                  <option key={bt.key} value={bt.key}>
                    {bt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewBizOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => createBizMutation.mutate({ name: bizName, business_type: bizType })}
              disabled={!bizName.trim() || createBizMutation.isPending}
            >
              {createBizMutation.isPending ? "Enviando..." : "Solicitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Business Dialog */}
      <Dialog open={editBizOpen} onOpenChange={setEditBizOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Configurar Negocio</DialogTitle>
            <DialogDescription>Edita el nombre de tu negocio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre del negocio</Label>
              <Input value={editBizName} onChange={(e) => setEditBizName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditBizOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => updateBizMutation.mutate({ id: editBizId, name: editBizName })}
              disabled={!editBizName.trim() || updateBizMutation.isPending}
            >
              {updateBizMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Create/Edit Dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingBranch ? "Editar Sucursal" : "Nueva Sucursal"}</DialogTitle>
            <DialogDescription>
              {editingBranch
                ? "Actualiza los datos de la sucursal."
                : "Se enviará una solicitud de aprobación al administrador."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre *</Label>
              <Input
                placeholder="Ej: Sucursal Centro"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Dirección</Label>
              <Input
                placeholder="Ej: Av. Principal #123"
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Teléfono</Label>
              <Input placeholder="Ej: 555-1234" value={branchPhone} onChange={(e) => setBranchPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBranchDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => branchMutation.mutate()}
              disabled={!branchName.trim() || branchMutation.isPending}
            >
              {branchMutation.isPending ? "Guardando..." : editingBranch ? "Guardar" : "Solicitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
};

export default AppSidebar;

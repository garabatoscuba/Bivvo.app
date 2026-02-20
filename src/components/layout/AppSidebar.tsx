import { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches } from '@/hooks/useBranches';
import { useSubscription } from '@/hooks/useSubscription';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
} from '@/components/ui/sidebar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard, Package, ShoppingCart, Receipt, Users, Settings,
  Building2, Shield, LogOut, CreditCard, Download, PlusCircle, Store,
  ChevronDown, Dumbbell,
} from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isSuperAdmin, signOut } = useAuth();
  const { data: branches = [] } = useBranches();
  const { planType } = useSubscription();
  const { isInstalled } = usePWAInstall();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newBizOpen, setNewBizOpen] = useState(false);
  const [bizName, setBizName] = useState('');

  const activeBranch = branches.find(b => b.id === profile?.branch_id);

  // Fetch user's businesses
  const { data: userBusinesses = [] } = useQuery({
    queryKey: ['user-businesses', profile?.user_id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('owner_id', profile.id)
        .order('created_at');
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const createBizMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: biz, error } = await supabase
        .from('businesses')
        .insert({ name, owner_id: profile!.id, plan_type: 'free' })
        .select()
        .single();
      if (error) throw error;
      await supabase.from('branches').insert({ business_id: biz.id, name: 'Principal', is_main: true });
      return biz;
    },
    onSuccess: (biz) => {
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
      toast({ title: 'Negocio creado', description: `${biz.name} está listo.` });
      setNewBizOpen(false);
      setBizName('');
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleAddBusiness = (type: 'store' | 'gym') => {
    if (type === 'gym') return;
    if (planType === 'free') {
      navigate('/plans');
      return;
    }
    setNewBizOpen(true);
  };

  const superAdminItems = [
    { title: 'Panel Admin', url: '/admin', icon: Shield },
    { title: 'Usuarios', url: '/admin/users', icon: Users },
  ];

  const businessItems = [
    { title: 'Dashboard', url: '/', icon: LayoutDashboard },
    { title: 'Inventario', url: '/inventory', icon: Package },
    { title: 'Punto de Venta', url: '/pos', icon: ShoppingCart },
    { title: 'Ventas', url: '/sales', icon: Receipt },
    { title: 'Empleados', url: '/employees', icon: Users },
    { title: 'Sucursales', url: '/branches', icon: Building2 },
    { title: 'Configuración', url: '/settings', icon: Settings },
    { title: 'Planes', url: '/plans', icon: CreditCard },
  ];

  const isActive = (url: string) => {
    if (url === '/') return location.pathname === '/';
    return location.pathname.startsWith(url);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold tracking-tight text-foreground">GestorPro</span>
        </Link>
      </SidebarHeader>

      <Separator className="mx-4 w-auto" />

      <SidebarContent className="pt-2">
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Admin</SidebarGroupLabel>
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

        {/* Negocios dropdown */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton className="justify-between">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        <span className="text-sm">Negocios</span>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {userBusinesses.length > 0 ? (
                      userBusinesses.map((biz) => (
                        <DropdownMenuItem key={biz.id} className="gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{biz.name}</span>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                        Sin negocios
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2" onSelect={() => handleAddBusiness('store')}>
                      <Store className="h-3.5 w-3.5" />
                      <span>Tienda</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 opacity-50" disabled>
                      <Dumbbell className="h-3.5 w-3.5" />
                      <span>Gym</span>
                      <Badge variant="secondary" className="ml-auto text-[9px] py-0">Próximamente</Badge>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!isInstalled && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/install')}>
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

      <SidebarFooter className="border-t border-border/60 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {profile?.full_name ? getInitials(profile.full_name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium leading-tight">{profile?.full_name || 'Usuario'}</p>
            <p className="truncate text-[11px] text-muted-foreground">{profile?.email}</p>
            {activeBranch && (
              <p className="truncate text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-2.5 w-2.5 shrink-0" />
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
            <DialogTitle>Nueva Tienda</DialogTitle>
            <DialogDescription>Se creará con una sucursal principal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre del negocio</Label>
              <Input
                placeholder="Ej: Mi Tienda"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewBizOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={() => createBizMutation.mutate(bizName)}
              disabled={!bizName.trim() || createBizMutation.isPending}
            >
              {createBizMutation.isPending ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
};

export default AppSidebar;

import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches } from '@/hooks/useBranches';
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
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  Users,
  Settings,
  Building2,
  
  TrendingUp,
  Shield,
  LogOut,
  Store,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const AppSidebar = () => {
  const location = useLocation();
  const { profile, isSuperAdmin, signOut } = useAuth();
  const { data: branches = [] } = useBranches();

  const activeBranch = branches.find(b => b.id === profile?.branch_id);

  const superAdminItems = [
    { title: 'Panel Admin', url: '/admin', icon: Shield },
    { title: 'Negocios', url: '/admin/businesses', icon: Store },
    { title: 'Estadísticas', url: '/admin/stats', icon: TrendingUp },
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
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link to="/" className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-foreground" />
          <span className="text-base font-semibold text-foreground">GestorPro</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Super Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Menú Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {businessItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              {profile?.full_name ? getInitials(profile.full_name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium">{profile?.full_name || 'Usuario'}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            {activeBranch && (
              <p className="truncate text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3 shrink-0" />
                {activeBranch.name}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import EmployeeSalaryView from '@/components/cobro/EmployeeSalaryView';
import CobrosResumen from '@/components/cobro/CobrosResumen';
import AdminReportesTab from '@/components/cobro/AdminReportesTab';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import SinJornadaActiva from '@/components/employees/SinJornadaActiva';
import SinJornadaAutorizada from '@/components/employees/SinJornadaAutorizada';

const Cobros = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const isAdminRole = isOwner || isManager || isSuperAdmin;
  const { jornadaActiva, jornada, isLoading: jornadaLoading } = useJornadaActiva();

  // Check if user is an employee of a copy_shop business
  const { data: employeeRecord, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee-record-cobros', profile?.email],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, business_id, branch_id, businesses!employees_business_id_fkey(business_type)')
        .eq('email', profile!.email)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.email,
  });

  const isCopyShopEmployee = (employeeRecord as any)?.businesses?.business_type === 'copy_shop';

  // Check if owner's active business is copy_shop
  const { data: activeBiz } = useQuery({
    queryKey: ['active-biz-type', profile?.business_id],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('business_type').eq('id', profile!.business_id!).single();
      return data;
    },
    enabled: !!profile?.business_id,
  });
  const isCopyShopOwner = activeBiz?.business_type === 'copy_shop' && isAdminRole;

  // Determine which view to show
  const showAdminView = isCopyShopOwner;
  const showEmployeeView = isCopyShopEmployee;

  if (loadingEmployee || (!isAdminRole && jornadaLoading)) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </AppLayout>
    );
  }

  // Jornada restriction for non-privileged users
  if (!isAdminRole && !jornadaActiva) {
    return <AppLayout><SinJornadaActiva /></AppLayout>;
  }
  if (!isAdminRole && jornadaActiva && jornada?.metodo_apertura !== 'manual_gerente') {
    return <AppLayout><SinJornadaAutorizada /></AppLayout>;
  }

  // If admin AND employee, show both views in tabs
  if (showAdminView && showEmployeeView) {
    return (
      <AppLayout>
        <div className="space-y-4 md:space-y-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Reportes</h1>
            <p className="text-sm text-muted-foreground">Reportes diarios y resumen de cobros</p>
          </div>

          <Tabs defaultValue="mi-cobro" className="space-y-4">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="mi-cobro">Mi Cobro</TabsTrigger>
              <TabsTrigger value="reportes">Reportes</TabsTrigger>
            </TabsList>

            <TabsContent value="mi-cobro">
              <EmployeeSalaryView
                employeeBusinessId={employeeRecord!.business_id}
                employeeBranchId={employeeRecord?.branch_id ?? profile?.branch_id ?? null}
              />
            </TabsContent>
            <TabsContent value="reportes">
              <AdminReportesTab businessId={profile?.business_id || ''} />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    );
  }

  // Employee-only view
  if (showEmployeeView && !showAdminView) {
    return (
      <AppLayout>
        <EmployeeSalaryView
          employeeBusinessId={employeeRecord!.business_id}
          employeeBranchId={employeeRecord?.branch_id ?? profile?.branch_id ?? null}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-muted-foreground">Reportes diarios y resumen de cobros</p>
        </div>

        <Tabs defaultValue="reportes" className="space-y-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="reportes">Reportes</TabsTrigger>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
          </TabsList>

          <TabsContent value="reportes">
            <AdminReportesTab businessId={profile?.business_id || ''} />
          </TabsContent>
          <TabsContent value="resumen">
            <CobrosResumen />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Cobros;

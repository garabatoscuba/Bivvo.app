import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import SalaryConfigTab from '@/components/cobro/SalaryConfigTab';
import CommissionsTab from '@/components/cobro/CommissionsTab';
import EmployeeSalaryView from '@/components/cobro/EmployeeSalaryView';
import CobrosResumen from '@/components/cobro/CobrosResumen';
import CashCalculator from '@/components/cobro/CashCalculator';

const VISION_HABANA_BIZ_ID = '03ab1b9d-c0ff-412c-9b78-c86d320dc41c';

const Cobros = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const isAdminRole = isOwner || isManager || isSuperAdmin;

  // Check if user is an employee of Vision Habana
  const { data: employeeRecord, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee-record-cobros', profile?.email],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, business_id, branch_id')
        .eq('email', profile!.email)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.email,
  });

  const isVisionHabanaEmployee = employeeRecord?.business_id === VISION_HABANA_BIZ_ID;
  const isVisionHabanaOwner = profile?.business_id === VISION_HABANA_BIZ_ID && isAdminRole;

  // Determine which view to show
  const showAdminView = isVisionHabanaOwner;
  const showEmployeeView = isVisionHabanaEmployee && !showAdminView;

  if (loadingEmployee) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </AppLayout>
    );
  }

  // Employee view
  if (showEmployeeView) {
    return (
      <AppLayout>
        <Tabs defaultValue="salario" className="space-y-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="salario">Mi Cobro</TabsTrigger>
            <TabsTrigger value="calculadora">Calculadora</TabsTrigger>
          </TabsList>
          <TabsContent value="salario">
            <EmployeeSalaryView
              employeeBusinessId={employeeRecord!.business_id}
              employeeBranchId={employeeRecord?.branch_id ?? profile?.branch_id ?? null}
            />
          </TabsContent>
          <TabsContent value="calculadora">
            <CashCalculator />
          </TabsContent>
        </Tabs>
      </AppLayout>
    );
  }

  // Admin view
  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Cobro</h1>
          <p className="text-sm text-muted-foreground">Gestión de salarios, comisiones y cobros</p>
        </div>

        <Tabs defaultValue="resumen" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="config">Salarios</TabsTrigger>
            <TabsTrigger value="comisiones">Comisiones</TabsTrigger>
            <TabsTrigger value="calculadora">Calculadora</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            <CobrosResumen />
          </TabsContent>
          <TabsContent value="config">
            <SalaryConfigTab businessId={profile?.business_id || ''} />
          </TabsContent>
          <TabsContent value="comisiones">
            <CommissionsTab businessId={profile?.business_id || ''} />
          </TabsContent>
          <TabsContent value="calculadora">
            <CashCalculator />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Cobros;

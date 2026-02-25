import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { SyncGate } from "@/components/layout/SyncGate";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import POS from "./pages/POS";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import Employees from "./pages/Employees";
import Sales from "./pages/Sales";
import Settings from "./pages/Settings";
import Plans from "./pages/Plans";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import StoreSettings from "./pages/StoreSettings";
import PublicStorefront from "./pages/PublicStorefront";
import Orders from "./pages/Orders";
import Services from "./pages/Services";
import Cobros from "./pages/Cobros";
import Nomina from "./pages/Nomina";
import JornadaEntrada from "./pages/JornadaEntrada";
import OnboardingEmpleado from "./pages/OnboardingEmpleado";
import MyEmployment from "./pages/MyEmployment";
import AuthCallback from "./pages/AuthCallback";


const queryClient = new QueryClient();

const App = () => {
  usePWAUpdate();
  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <TooltipProvider>
      <AuthProvider>
        <OfflineProvider>
          <SyncGate>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
                <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
                
                <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
                <Route path="/mi-empleo" element={<ProtectedRoute><MyEmployment /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
                <Route path="/store-settings" element={<ProtectedRoute><StoreSettings /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
                <Route path="/cobros" element={<ProtectedRoute><Cobros /></ProtectedRoute>} />
                <Route path="/nomina" element={<ProtectedRoute><Nomina /></ProtectedRoute>} />
                <Route path="/admin/businesses" element={<ProtectedRoute requireSuperAdmin><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/stats" element={<ProtectedRoute requireSuperAdmin><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute requireSuperAdmin><AdminUsers /></ProtectedRoute>} />
                <Route path="/install" element={<Install />} />
                <Route path="/jornada/entrada" element={<JornadaEntrada />} />
                <Route path="/onboarding/empleado" element={<OnboardingEmpleado />} />
                <Route path="/tienda/:bizSlug/:branchSlug" element={<PublicStorefront />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              
            </BrowserRouter>
          </SyncGate>
        </OfflineProvider>
      </AuthProvider>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;

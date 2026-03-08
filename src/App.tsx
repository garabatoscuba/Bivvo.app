import { lazy, Suspense } from "react";
import { LazyErrorBoundary } from "@/components/LazyErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { PWAInstallProvider } from "@/contexts/PWAInstallContext";
import { SyncGate } from "@/components/layout/SyncGate";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { Loader2 } from "lucide-react";

// Eagerly loaded (critical path)
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";

// Lazy loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inventory = lazy(() => import("./pages/Inventory"));
const POS = lazy(() => import("./pages/POS"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminBusinesses = lazy(() => import("./pages/admin/AdminBusinesses"));
const AdminOffers = lazy(() => import("./pages/admin/AdminOffers"));
const AdminModules = lazy(() => import("./pages/admin/AdminModules"));
const AdminAssistant = lazy(() => import("./pages/admin/AdminAssistant"));
const AdminPartners = lazy(() => import("./pages/admin/AdminPartners"));
const Employees = lazy(() => import("./pages/Employees"));
const Sales = lazy(() => import("./pages/Sales"));
const Settings = lazy(() => import("./pages/Settings"));
const Plans = lazy(() => import("./pages/Plans"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Install = lazy(() => import("./pages/Install"));
const StoreSettings = lazy(() => import("./pages/StoreSettings"));
const PublicStorefront = lazy(() => import("./pages/PublicStorefront"));
const Orders = lazy(() => import("./pages/Orders"));
const Services = lazy(() => import("./pages/Services"));
const Cobros = lazy(() => import("./pages/Cobros"));
const Nomina = lazy(() => import("./pages/Nomina"));
const Caja = lazy(() => import("./pages/Caja"));
const Tesoreria = lazy(() => import("./pages/Tesoreria"));
const Contabilidad = lazy(() => import("./pages/Contabilidad"));
const Impresiones = lazy(() => import("./pages/Impresiones"));
const JornadaEntrada = lazy(() => import("./pages/JornadaEntrada"));
const OnboardingEmpleado = lazy(() => import("./pages/OnboardingEmpleado"));
const MyEmployment = lazy(() => import("./pages/MyEmployment"));
const ReviewPage = lazy(() => import("./pages/ReviewPage"));
const PartnerDashboard = lazy(() => import("./pages/PartnerDashboard"));

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      networkMode: 'always',
    },
    queries: {
      networkMode: 'always',
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);

const App = () => {
  usePWAUpdate();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <AuthProvider>
            <PWAInstallProvider>
              <OfflineProvider>
                <SyncGate>
                  <Toaster />
                <Sonner />
                <BrowserRouter>
                  <LazyErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                        <Route path="/admin" element={<ProtectedRoute requireSuperAdmin><AdminDashboard /></ProtectedRoute>} />
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
                        <Route path="/caja" element={<ProtectedRoute><Caja /></ProtectedRoute>} />
                        <Route path="/tesoreria" element={<ProtectedRoute><Tesoreria /></ProtectedRoute>} />
                        <Route path="/contabilidad" element={<ProtectedRoute><Contabilidad /></ProtectedRoute>} />
                        <Route path="/mi-red" element={<ProtectedRoute><PartnerDashboard /></ProtectedRoute>} />
                        <Route path="/admin/businesses" element={<ProtectedRoute requireSuperAdmin><AdminBusinesses /></ProtectedRoute>} />
                        <Route path="/admin/offers" element={<ProtectedRoute requireSuperAdmin><AdminOffers /></ProtectedRoute>} />
                        <Route path="/admin/users" element={<ProtectedRoute requireSuperAdmin><AdminUsers /></ProtectedRoute>} />
                        <Route path="/admin/assistant" element={<ProtectedRoute requireSuperAdmin><AdminAssistant /></ProtectedRoute>} />
                        <Route path="/admin/modules" element={<ProtectedRoute requireSuperAdmin><AdminModules /></ProtectedRoute>} />
                        <Route path="/admin/partners" element={<ProtectedRoute requireSuperAdmin><AdminPartners /></ProtectedRoute>} />
                        <Route path="/install" element={<Install />} />
                        <Route path="/jornada/entrada" element={<JornadaEntrada />} />
                        <Route path="/onboarding/empleado" element={<OnboardingEmpleado />} />
                        <Route path="/s/:bizSlug" element={<PublicStorefront />} />
                        <Route path="/tienda/:bizSlug/:branchSlug" element={<PublicStorefront />} />
                        <Route path="/review/:token" element={<ReviewPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </LazyErrorBoundary>
                </BrowserRouter>
              </SyncGate>
              </OfflineProvider>
            </PWAInstallProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Tasks from "./pages/Tasks";
import Gantt from "./pages/Gantt";
import People from "./pages/People";
import Settings from "./pages/Settings";
import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import AdminResetPassword from "./pages/AdminResetPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
    },
  },
});

const ProtectedRoute = ({ children, requireSubscription = true }: { children: React.ReactNode; requireSubscription?: boolean }) => {
  const { isAuthenticated, isLoading, hasActiveSubscription, subscriptionChecked } = useAuth();

  // Wait for initial auth loading only
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Only redirect if subscription was checked AND is not active
  // Don't block rendering while waiting for subscription check
  if (requireSubscription && subscriptionChecked && !hasActiveSubscription) {
    return <Navigate to="/?subscription=required" replace />;
  }

  return <>{children}</>;
};

// Redirect to external URL (full page navigation)
const ExternalRedirect = ({ to }: { to: string }) => {
  window.location.href = to;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Redirecionando...</p>
      </div>
    </div>
  );
};

// Subdomain detection
const hostname = window.location.hostname;
const isAppSubdomain = hostname === 'app.tarefaa.com.br';
const isAdminSubdomain = hostname === 'admin.tarefaa.com.br';
const isMainDomain = hostname === 'tarefaa.com.br' || hostname === 'www.tarefaa.com.br';
const isDevelopment = !isAppSubdomain && !isAdminSubdomain && !isMainDomain;

// Smart root redirect for app subdomain
const AppRootRedirect = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // =============================================
  // MAIN DOMAIN — tarefaa.com.br
  // Landing + auth pages only, no app routes
  // =============================================
  if (isMainDomain) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth" element={isAuthenticated ? <ExternalRedirect to="https://app.tarefaa.com.br/dashboard" /> : <Auth />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />

        {/* App routes redirect to app subdomain */}
        <Route path="/dashboard" element={<ExternalRedirect to="https://app.tarefaa.com.br/dashboard" />} />
        <Route path="/projects" element={<ExternalRedirect to="https://app.tarefaa.com.br/projects" />} />
        <Route path="/projects/:projectId" element={<ExternalRedirect to={`https://app.tarefaa.com.br${window.location.pathname}`} />} />
        <Route path="/tasks" element={<ExternalRedirect to="https://app.tarefaa.com.br/tasks" />} />
        <Route path="/gantt" element={<ExternalRedirect to="https://app.tarefaa.com.br/gantt" />} />
        <Route path="/people" element={<ExternalRedirect to="https://app.tarefaa.com.br/people" />} />
        <Route path="/settings" element={<ExternalRedirect to="https://app.tarefaa.com.br/settings" />} />

        {/* Admin routes redirect to admin subdomain */}
        <Route path="/admin/*" element={<ExternalRedirect to="https://admin.tarefaa.com.br/admin/login" />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // =============================================
  // APP SUBDOMAIN — app.tarefaa.com.br
  // App routes + login, no landing
  // =============================================
  if (isAppSubdomain) {
    return (
      <Routes>
        <Route path="/" element={<AppRootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Auth />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected app routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
        <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
        <Route path="/gantt" element={<ProtectedRoute><Gantt /></ProtectedRoute>} />
        <Route path="/people" element={<ProtectedRoute><People /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        {/* Admin routes redirect to admin subdomain */}
        <Route path="/admin/*" element={<ExternalRedirect to="https://admin.tarefaa.com.br/admin/login" />} />

        {/* Landing redirect to main domain */}
        <Route path="/terms" element={<ExternalRedirect to="https://tarefaa.com.br/terms" />} />
        <Route path="/privacy" element={<ExternalRedirect to="https://tarefaa.com.br/privacy" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // =============================================
  // ADMIN SUBDOMAIN — admin.tarefaa.com.br
  // Only admin routes
  // =============================================
  if (isAdminSubdomain) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/panel" element={<AdminPanel />} />
        <Route path="/admin/reset-password" element={<AdminResetPassword />} />

        {/* Everything else redirects to admin login */}
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    );
  }

  // =============================================
  // DEVELOPMENT — localhost or any other hostname
  // All routes available (current behavior)
  // =============================================
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* Admin routes - completely separate */}
      <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/panel" element={<AdminPanel />} />
      <Route path="/admin/reset-password" element={<AdminResetPassword />} />

      {/* Protected app routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
      <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
      <Route path="/gantt" element={<ProtectedRoute><Gantt /></ProtectedRoute>} />
      <Route path="/people" element={<ProtectedRoute><People /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <DataProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { SupportChat } from "@/components/SupportChat";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import DashboardPage from "@/pages/dashboard";
import CoachingPage from "@/pages/coaching";
import LeadsPage from "@/pages/leads";
import CallPrepPage from "@/pages/call-prep";
import TeamPage from "@/pages/team";
import SdrProfilePage from "@/pages/sdr-profile";
import ManagerProfilePage from "@/pages/manager-profile";
import AEProfilePage from "@/pages/ae-profile";
import ReportsPage from "@/pages/reports";
import ManagerDashboard from "@/pages/manager-dashboard";
import AEPipelinePage from "@/pages/ae-pipeline";
import AMWorkspacePage from "@/pages/am-workspace";
import InboundEmailsPage from "@/pages/inbound-emails";
import BudgetingPage from "@/pages/budgeting";
import SettingsPage from "@/pages/settings";
import RobinSettingsPage from "@/pages/robin-settings";
import LearningPage from "@/pages/learning";

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (isLoading || redirected) return;
    
    if (!user) {
      setRedirected(true);
      setLocation("/login");
      return;
    }
    
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      setRedirected(true);
      setLocation("/dashboard");
    }
  }, [isLoading, user, setLocation, allowedRoles, redirected]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user || redirected) {
    return <LoadingScreen />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (isLoading || redirected) return;
    
    if (user) {
      setRedirected(true);
      setLocation("/dashboard");
    }
  }, [isLoading, user, setLocation, redirected]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (user || redirected) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex h-14 items-center justify-between gap-4 border-b px-4 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto pb-20 md:pb-0">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <h1 className="text-2xl font-semibold mb-2">{title}</h1>
      <p className="text-muted-foreground">This page is coming soon.</p>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <PublicOnlyRoute>
          <LandingPage />
        </PublicOnlyRoute>
      </Route>
      
      <Route path="/login">
        <PublicOnlyRoute>
          <LoginPage />
        </PublicOnlyRoute>
      </Route>
      
      <Route path="/signup">
        <PublicOnlyRoute>
          <SignupPage />
        </PublicOnlyRoute>
      </Route>
      
      <Route path="/forgot-password">
        <PublicOnlyRoute>
          <ForgotPasswordPage />
        </PublicOnlyRoute>
      </Route>
      
      <Route path="/reset-password">
        <PublicOnlyRoute>
          <ResetPasswordPage />
        </PublicOnlyRoute>
      </Route>
      
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <DashboardPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/leads">
        <ProtectedRoute>
          <DashboardLayout>
            <LeadsPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/call-prep/:leadId">
        <ProtectedRoute>
          <DashboardLayout>
            <CallPrepPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/coaching">
        <ProtectedRoute>
          <DashboardLayout>
            <CoachingPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/team">
        <ProtectedRoute>
          <DashboardLayout>
            <TeamPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/team/:sdrId">
        <ProtectedRoute>
          <DashboardLayout>
            <SdrProfilePage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/team/manager/:managerId">
        <ProtectedRoute>
          <DashboardLayout>
            <ManagerProfilePage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/team/ae/:aeId">
        <ProtectedRoute>
          <DashboardLayout>
            <AEProfilePage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/manager-dashboard">
        <ProtectedRoute allowedRoles={["admin", "manager"]}>
          <DashboardLayout>
            <ManagerDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/reports">
        <ProtectedRoute allowedRoles={["admin", "manager"]}>
          <DashboardLayout>
            <ReportsPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/ae-pipeline">
        <ProtectedRoute allowedRoles={["admin", "manager", "account_executive"]}>
          <DashboardLayout>
            <AEPipelinePage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/am-workspace">
        <ProtectedRoute allowedRoles={["admin", "manager", "account_executive"]}>
          <DashboardLayout>
            <AMWorkspacePage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/inbound-emails">
        <ProtectedRoute allowedRoles={["admin", "manager", "sdr"]}>
          <DashboardLayout>
            <InboundEmailsPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/budgeting">
        <ProtectedRoute>
          <DashboardLayout>
            <BudgetingPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/learning">
        <ProtectedRoute>
          <DashboardLayout>
            <LearningPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <DashboardLayout>
            <SettingsPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/robin-settings">
        <ProtectedRoute>
          <DashboardLayout>
            <RobinSettingsPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="lead-intel-theme">
          <TooltipProvider>
            <AuthProvider>
              <Toaster />
              <Router />
              <SupportChat />
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

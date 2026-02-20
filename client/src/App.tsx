import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import VendorDashboardPage from "@/pages/vendor-dashboard";
import DeliveryRecordsPage from "@/pages/delivery-records";
import CashoutsListPage from "@/pages/cashouts-list";
import CashoutDetailPage from "@/pages/cashout-detail";
import RequestCashoutPage from "@/pages/request-cashout";
import AdminCounterpartiesPage from "@/pages/admin-counterparties";
import AdminVendorMastersPage from "@/pages/admin-vendor-masters";
import AdminMappingsPage from "@/pages/admin-mappings";
import AdminLedgerPage from "@/pages/admin-ledger";
import SettlementsPage from "@/pages/settlements";
import { Skeleton } from "@/components/ui/skeleton";

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/admin/counterparties" component={AdminCounterpartiesPage} />
      <Route path="/admin/vendor-masters" component={AdminVendorMastersPage} />
      <Route path="/admin/vendor-masters/:id/pricing" component={AdminVendorMastersPage} />
      <Route path="/admin/mappings" component={AdminMappingsPage} />
      <Route path="/delivery-records" component={DeliveryRecordsPage} />
      <Route path="/cashouts" component={CashoutsListPage} />
      <Route path="/cashouts/:id" component={CashoutDetailPage} />
      <Route path="/admin/ledger" component={AdminLedgerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function CounterpartyRouter() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/delivery-records" component={DeliveryRecordsPage} />
      <Route path="/cashouts" component={CashoutsListPage} />
      <Route path="/cashouts/:id" component={CashoutDetailPage} />
      <Route path="/settlements" component={SettlementsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function VendorRouter() {
  return (
    <Switch>
      <Route path="/" component={VendorDashboardPage} />
      <Route path="/my-deliveries" component={DeliveryRecordsPage} />
      <Route path="/cashouts/new" component={RequestCashoutPage} />
      <Route path="/cashouts" component={CashoutsListPage} />
      <Route path="/cashouts/:id" component={CashoutDetailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RoleRouter() {
  const { user } = useAuth();
  const role = user?.role || "counterparty";

  if (role === "admin") return <AdminRouter />;
  if (role === "vendor") return <VendorRouter />;
  return <CounterpartyRouter />;
}

function AuthenticatedApp() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 p-3 border-b sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <RoleRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

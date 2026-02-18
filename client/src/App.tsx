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
import UploadPage from "@/pages/upload";
import VendorListPage from "@/pages/vendor-list";
import VendorInvoicesPage from "@/pages/vendor-invoices";
import VendorMyInvoicesPage from "@/pages/vendor-my-invoices";
import OfferReviewPage from "@/pages/offer-review";
import OffersListPage from "@/pages/offers-list";
import AdminLedgerPage from "@/pages/admin-ledger";
import FeeRatesPage from "@/pages/fee-rates";
import FinancingPage from "@/pages/financing";
import AdminRestaurantsPage from "@/pages/admin-restaurants";
import AdminVendorsPage from "@/pages/admin-vendors";
import VendorRequestCashoutPage from "@/pages/vendor-request-cashout";
import { Skeleton } from "@/components/ui/skeleton";

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/admin/restaurants" component={AdminRestaurantsPage} />
      <Route path="/admin/vendors" component={AdminVendorsPage} />
      <Route path="/restaurants/:id/upload" component={UploadPage} />
      <Route path="/restaurants/:id/vendors" component={VendorListPage} />
      <Route path="/restaurants/:id/vendors/:vendorId" component={VendorInvoicesPage} />
      <Route path="/offers" component={OffersListPage} />
      <Route path="/offers/:id" component={OfferReviewPage} />
      <Route path="/admin/fee-rates" component={FeeRatesPage} />
      <Route path="/admin/ledger" component={AdminLedgerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RestaurantRouter() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/restaurants/:id/upload" component={UploadPage} />
      <Route path="/restaurants/:id/vendors" component={VendorListPage} />
      <Route path="/restaurants/:id/vendors/:vendorId" component={VendorInvoicesPage} />
      <Route path="/financing" component={FinancingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function VendorRouter() {
  return (
    <Switch>
      <Route path="/" component={VendorDashboardPage} />
      <Route path="/vendor/invoices" component={VendorMyInvoicesPage} />
      <Route path="/cashouts/new" component={VendorRequestCashoutPage} />
      <Route path="/cashouts" component={OffersListPage} />
      <Route path="/cashouts/:id" component={OfferReviewPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RoleRouter() {
  const { user } = useAuth();
  const role = user?.role || "restaurant";

  if (role === "admin") return <AdminRouter />;
  if (role === "vendor") return <VendorRouter />;
  return <RestaurantRouter />;
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

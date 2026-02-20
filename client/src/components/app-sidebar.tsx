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
} from "@/components/ui/sidebar";
import { LayoutDashboard, BookOpen, LogOut, DollarSign, Building2, Link2, Truck, Banknote, Store, Plus } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const navByRole: Record<string, { title: string; url: string; icon: any }[]> = {
  admin: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Counterparties", url: "/admin/counterparties", icon: Building2 },
    { title: "Vendor Masters", url: "/admin/vendor-masters", icon: Store },
    { title: "Vendor Mappings", url: "/admin/mappings", icon: Link2 },
    { title: "Delivery Records", url: "/delivery-records", icon: Truck },
    { title: "Cashouts", url: "/cashouts", icon: DollarSign },
    { title: "Admin Ledger", url: "/admin/ledger", icon: BookOpen },
  ],
  counterparty: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Delivery Records", url: "/delivery-records", icon: Truck },
    { title: "Cashouts", url: "/cashouts", icon: DollarSign },
    { title: "Settlements", url: "/settlements", icon: Banknote },
  ],
  vendor: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "My Deliveries", url: "/my-deliveries", icon: Truck },
    { title: "Cashouts", url: "/cashouts", icon: DollarSign },
    { title: "Request Cashout", url: "/cashouts/new", icon: Plus },
  ],
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  counterparty: "Counterparty",
  vendor: "Vendor",
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const role = user?.role || "counterparty";
  const navItems = navByRole[role] || navByRole.counterparty;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
            <DollarSign className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">Payables Cashout</h2>
            <p className="text-xs text-muted-foreground">Invoice Financing</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.url === "/"
                    ? location === "/"
                    : location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={isActive ? "bg-sidebar-accent" : ""}
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <Badge variant="secondary" data-testid="badge-user-role">{roleLabels[role] || role}</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Clock, CheckCircle, TrendingUp, FileText } from "lucide-react";
import { Link } from "wouter";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Pending", color: "bg-chart-4/10 text-chart-4" },
  vendor_accepted: { label: "Accepted", color: "bg-chart-1/10 text-chart-1" },
  vendor_rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
  admin_approved: { label: "Approved", color: "bg-chart-2/10 text-chart-2" },
  admin_rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
  payout_sent: { label: "Paid", color: "bg-chart-3/10 text-chart-3" },
  repaid: { label: "Completed", color: "bg-chart-2/10 text-chart-2" },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground" },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function VendorDashboardPage() {
  const { data, isLoading } = useQuery<{
    totalAssigned: number;
    eligibleCashout: number;
    estimatedFee: number;
    netCashout: number;
    pendingCashouts: number;
    paidOut: number;
    invoiceCount: number;
    recentCashouts: { id: string; restaurantName: string; advanceAmount: string; feeAmount: string; netPayout: string; status: string; createdAt: string }[];
  }>({
    queryKey: ["/api/vendor/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "Total Payable",
      value: formatCurrency(data?.totalAssigned || 0),
      icon: DollarSign,
      testId: "stat-total-assigned",
    },
    {
      title: "Available for Cashout",
      value: formatCurrency(data?.netCashout || 0),
      subtitle: data?.estimatedFee ? `Fee: ${formatCurrency(data.estimatedFee)}` : undefined,
      icon: TrendingUp,
      testId: "stat-net-cashout",
    },
    {
      title: "Pending Cashouts",
      value: String(data?.pendingCashouts || 0),
      icon: Clock,
      testId: "stat-pending-cashouts",
    },
    {
      title: "Cash Received",
      value: formatCurrency(data?.paidOut || 0),
      icon: CheckCircle,
      testId: "stat-paid-out",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold" data-testid="heading-vendor-dashboard">Vendor Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data?.invoiceCount || 0} invoices across your account
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={stat.testId}>
                {stat.value}
              </div>
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Cashouts</CardTitle>
        </CardHeader>
        <CardContent>
          {(!data?.recentCashouts || data.recentCashouts.length === 0) ? (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground" data-testid="text-no-cashouts">No cashouts yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentCashouts.map((cashout) => {
                const statusInfo = STATUS_CONFIG[cashout.status] || { label: cashout.status, color: "bg-muted text-muted-foreground" };
                return (
                  <Link key={cashout.id} href={`/cashouts/${cashout.id}`}>
                    <div className="flex items-center justify-between gap-4 p-3 rounded-md border hover-elevate cursor-pointer" data-testid={`cashout-row-${cashout.id}`}>
                      <div>
                        <p className="font-medium text-sm">{cashout.restaurantName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(cashout.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-sm font-medium">
                            {formatCurrency(Number(cashout.netPayout))}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            Fee: {formatCurrency(Number(cashout.feeAmount))}
                          </p>
                        </div>
                        <Badge variant="secondary" className={statusInfo.color} data-testid={`badge-status-${cashout.id}`}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

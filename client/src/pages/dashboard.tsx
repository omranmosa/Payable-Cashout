import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, CheckCircle, Clock, AlertTriangle } from "lucide-react";

type DashboardStats = {
  totalOwed: number;
  eligibleOwed: number;
  financedOutstanding: number;
  overdue: number;
  recentOffers: Array<{
    id: string;
    vendorName: string;
    advanceAmount: string;
    status: string;
    createdAt: string;
  }>;
};

function StatCard({
  title,
  value,
  icon: Icon,
  accent,
  testId,
}: {
  title: string;
  value: string;
  icon: any;
  accent: string;
  testId: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className={`flex items-center justify-center w-8 h-8 rounded-md ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight" data-testid={testId}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your payables financing
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = data || {
    totalOwed: 0,
    eligibleOwed: 0,
    financedOutstanding: 0,
    overdue: 0,
    recentOffers: [],
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your payables financing
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Owed"
          value={formatCurrency(stats.totalOwed)}
          icon={DollarSign}
          accent="bg-accent text-accent-foreground"
          testId="stat-total-owed"
        />
        <StatCard
          title="Eligible for Financing"
          value={formatCurrency(stats.eligibleOwed)}
          icon={CheckCircle}
          accent="bg-accent text-accent-foreground"
          testId="stat-eligible-owed"
        />
        <StatCard
          title="Financed Outstanding"
          value={formatCurrency(stats.financedOutstanding)}
          icon={Clock}
          accent="bg-accent text-accent-foreground"
          testId="stat-financed-outstanding"
        />
        <StatCard
          title="Overdue"
          value={formatCurrency(stats.overdue)}
          icon={AlertTriangle}
          accent="bg-destructive/10 text-destructive"
          testId="stat-overdue"
        />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Recent Offers</h2>
        {stats.recentOffers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                No offers yet. Upload invoices and create your first cashout offer.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.recentOffers.map((offer) => (
              <Card key={offer.id} className="hover-elevate">
                <CardContent className="flex items-center justify-between gap-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-offer-vendor-${offer.id}`}>
                      {offer.vendorName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(offer.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatCurrency(Number(offer.advanceAmount))}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md ${
                        offer.status === "accepted"
                          ? "bg-chart-2/10 text-chart-2"
                          : offer.status === "pending"
                            ? "bg-chart-4/10 text-chart-4"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {offer.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

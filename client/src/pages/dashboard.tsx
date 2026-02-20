import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, DollarSign, Clock, CheckCircle } from "lucide-react";

type DashboardStats = {
  totalOutstandingDeliveries: number;
  totalOutstandingAmount: number;
  totalCashoutsRequested: number;
  totalCashoutsPaidOut: number;
};

function StatCard({
  title,
  value,
  icon: Icon,
  testId,
}: {
  title: string;
  value: string | number;
  icon: any;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function formatSAR(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "SAR",
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
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of outstanding deliveries and cashouts
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
    totalOutstandingDeliveries: 0,
    totalOutstandingAmount: 0,
    totalCashoutsRequested: 0,
    totalCashoutsPaidOut: 0,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of outstanding deliveries and cashouts
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Outstanding Deliveries"
          value={stats.totalOutstandingDeliveries}
          icon={Truck}
          testId="card-outstanding-deliveries"
        />
        <StatCard
          title="Outstanding Amount"
          value={formatSAR(stats.totalOutstandingAmount)}
          icon={DollarSign}
          testId="card-outstanding-amount"
        />
        <StatCard
          title="Cashouts Requested"
          value={formatSAR(stats.totalCashoutsRequested)}
          icon={Clock}
          testId="card-cashouts-requested"
        />
        <StatCard
          title="Cashouts Paid Out"
          value={formatSAR(stats.totalCashoutsPaidOut)}
          icon={CheckCircle}
          testId="card-cashouts-paid-out"
        />
      </div>
    </div>
  );
}

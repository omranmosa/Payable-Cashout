import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Truck, DollarSign, Clock, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import type { DeliveryRecord } from "@shared/schema";

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

export default function VendorDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  const { data: deliveries, isLoading: deliveriesLoading } = useQuery<DeliveryRecord[]>({
    queryKey: ["/api/delivery-records/outstanding"],
  });

  const isLoading = statsLoading || deliveriesLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
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

  const statValues = stats || {
    totalOutstandingDeliveries: 0,
    totalOutstandingAmount: 0,
    totalCashoutsRequested: 0,
    totalCashoutsPaidOut: 0,
  };

  const deliveryList = deliveries || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-row items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold" data-testid="heading-vendor-dashboard">
            Vendor Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {deliveryList.length} outstanding deliveries
          </p>
        </div>
        <Link href="/cashouts/new">
          <Button data-testid="button-request-cashout">Request Cashout</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Outstanding Deliveries"
          value={statValues.totalOutstandingDeliveries}
          icon={Truck}
          testId="card-outstanding-deliveries"
        />
        <StatCard
          title="Outstanding Amount"
          value={formatSAR(statValues.totalOutstandingAmount)}
          icon={DollarSign}
          testId="card-outstanding-amount"
        />
        <StatCard
          title="Cashouts Requested"
          value={formatSAR(statValues.totalCashoutsRequested)}
          icon={Clock}
          testId="card-cashouts-requested"
        />
        <StatCard
          title="Cashouts Paid Out"
          value={formatSAR(statValues.totalCashoutsPaidOut)}
          icon={CheckCircle}
          testId="card-cashouts-paid-out"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Outstanding Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {deliveryList.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground" data-testid="text-no-deliveries">
                No outstanding deliveries
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      Counterparty ID
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      Delivery Date
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                      Amount Earned
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryList.map((delivery, idx) => (
                    <tr
                      key={delivery.id}
                      className="border-b hover:bg-muted/50"
                      data-testid={`row-delivery-${delivery.id}`}
                    >
                      <td className="py-3 px-3" data-testid={`text-counterparty-${delivery.id}`}>
                        {delivery.counterpartyId}
                      </td>
                      <td className="py-3 px-3" data-testid={`text-date-${delivery.id}`}>
                        {new Date(delivery.deliveryDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right" data-testid={`text-amount-${delivery.id}`}>
                        {formatSAR(Number(delivery.amountEarned || 0))}
                      </td>
                      <td className="py-3 px-3" data-testid={`text-status-${delivery.id}`}>
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-muted text-muted-foreground">
                          {delivery.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

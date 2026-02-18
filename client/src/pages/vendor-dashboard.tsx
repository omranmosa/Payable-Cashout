import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Clock, CheckCircle, FileText } from "lucide-react";
import { Link } from "wouter";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function VendorDashboardPage() {
  const { data, isLoading } = useQuery<{
    totalAssigned: number;
    pendingOffers: number;
    acceptedOffers: number;
    invoiceCount: number;
    recentOffers: { id: string; restaurantName: string; advanceAmount: string; status: string; createdAt: string }[];
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
      title: "Total Assigned",
      value: formatCurrency(data?.totalAssigned || 0),
      icon: DollarSign,
      testId: "stat-total-assigned",
    },
    {
      title: "Pending Offers",
      value: String(data?.pendingOffers || 0),
      icon: Clock,
      testId: "stat-pending-offers",
    },
    {
      title: "Accepted Offers",
      value: String(data?.acceptedOffers || 0),
      icon: CheckCircle,
      testId: "stat-accepted-offers",
    },
    {
      title: "My Invoices",
      value: String(data?.invoiceCount || 0),
      icon: FileText,
      testId: "stat-invoice-count",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="heading-vendor-dashboard">Vendor Dashboard</h1>

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
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Offers</CardTitle>
        </CardHeader>
        <CardContent>
          {(!data?.recentOffers || data.recentOffers.length === 0) ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-offers">No offers yet</p>
          ) : (
            <div className="space-y-3">
              {data.recentOffers.map((offer) => (
                <Link key={offer.id} href={`/offers/${offer.id}`}>
                  <div className="flex items-center justify-between gap-4 p-3 rounded-md border hover-elevate cursor-pointer" data-testid={`offer-row-${offer.id}`}>
                    <div>
                      <p className="font-medium text-sm">{offer.restaurantName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(offer.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {formatCurrency(Number(offer.advanceAmount))}
                      </span>
                      <Badge
                        variant={offer.status === "accepted" ? "default" : "secondary"}
                        data-testid={`badge-status-${offer.id}`}
                      >
                        {offer.status}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

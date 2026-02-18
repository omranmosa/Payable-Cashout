import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ChevronRight, DollarSign } from "lucide-react";

type OfferItem = {
  id: string;
  vendorName: string;
  restaurantName: string;
  advanceAmount: string;
  feeAmount: string;
  status: string;
  createdAt: string;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function OffersListPage() {
  const { data: offers, isLoading } = useQuery<OfferItem[]>({
    queryKey: ["/api/offers"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Offers</h1>
          <p className="text-sm text-muted-foreground mt-1">All cashout offers</p>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="h-5 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Offers</h1>
        <p className="text-sm text-muted-foreground mt-1">All cashout offers</p>
      </div>

      {!offers || offers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No offers yet. Select eligible invoices and create a cashout offer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {offers.map((offer) => {
            const statusColor =
              offer.status === "accepted"
                ? "bg-chart-2/10 text-chart-2"
                : offer.status === "pending"
                  ? "bg-chart-4/10 text-chart-4"
                  : "bg-muted text-muted-foreground";
            return (
              <Link key={offer.id} href={`/offers/${offer.id}`}>
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 rounded-md bg-accent">
                        <DollarSign className="w-4 h-4 text-accent-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-offer-vendor-${offer.id}`}>
                          {offer.vendorName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(offer.createdAt).toLocaleDateString()} &middot;{" "}
                          {offer.restaurantName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatCurrency(Number(offer.advanceAmount))}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-md ${statusColor}`}>
                          {offer.status}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

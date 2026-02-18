import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ChevronRight, DollarSign } from "lucide-react";
import { useAuth } from "@/lib/auth";

type OfferItem = {
  id: string;
  vendorName: string;
  restaurantName: string;
  advanceAmount: string;
  feeAmount: string;
  status: string;
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-chart-4/10 text-chart-4" },
  vendor_accepted: { label: "Vendor Accepted", color: "bg-chart-1/10 text-chart-1" },
  vendor_rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
  restaurant_approved: { label: "Approved", color: "bg-chart-2/10 text-chart-2" },
  restaurant_rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
  payout_sent: { label: "Payout Sent", color: "bg-chart-3/10 text-chart-3" },
  repaid: { label: "Repaid", color: "bg-chart-2/10 text-chart-2" },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground" },
};

const VENDOR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Pending", color: "bg-chart-4/10 text-chart-4" },
  vendor_accepted: { label: "Accepted", color: "bg-chart-1/10 text-chart-1" },
  vendor_rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
  restaurant_approved: { label: "Approved", color: "bg-chart-2/10 text-chart-2" },
  restaurant_rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
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

export default function OffersListPage() {
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";
  const pageTitle = isVendor ? "Cashouts" : "Offers";
  const pageSubtitle = isVendor ? "Your cashout requests" : "All cashout offers";
  const linkBase = isVendor ? "/cashouts" : "/offers";
  const statusMap = isVendor ? VENDOR_STATUS_CONFIG : STATUS_CONFIG;

  const { data: offers, isLoading } = useQuery<OfferItem[]>({
    queryKey: ["/api/offers"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{pageSubtitle}</p>
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
        <h1 className="text-xl font-semibold" data-testid="heading-offers-list">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{pageSubtitle}</p>
      </div>

      {!offers || offers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {isVendor ? "No cashouts yet." : "No offers yet. Select eligible invoices and create a cashout offer."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {offers.map((offer) => {
            const statusInfo = statusMap[offer.status] || { label: offer.status, color: "bg-muted text-muted-foreground" };
            const netPayout = Number(offer.advanceAmount) - Number(offer.feeAmount);
            return (
              <Link key={offer.id} href={`${linkBase}/${offer.id}`}>
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 rounded-md bg-accent">
                        <DollarSign className="w-4 h-4 text-accent-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-offer-vendor-${offer.id}`}>
                          {isVendor ? offer.restaurantName : offer.vendorName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(offer.createdAt).toLocaleDateString()}
                          {!isVendor && <> &middot; {offer.restaurantName}</>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {isVendor ? formatCurrency(netPayout) : formatCurrency(Number(offer.advanceAmount))}
                        </p>
                        {isVendor && (
                          <p className="text-xs text-muted-foreground">
                            Fee: {formatCurrency(Number(offer.feeAmount))}
                          </p>
                        )}
                        <Badge variant="secondary" className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
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

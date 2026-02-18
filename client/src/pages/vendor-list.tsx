import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useParams } from "wouter";
import { ChevronRight, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type VendorSummary = {
  id: string;
  name: string;
  invoiceCount: number;
  eligibleCount: number;
  totalAmount: number;
};

export default function VendorListPage() {
  const params = useParams<{ id: string }>();
  const restaurantId = params.id;

  const { data: vendors, isLoading } = useQuery<VendorSummary[]>({
    queryKey: ["/api/restaurants", restaurantId, "vendors"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Vendors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a vendor to view invoices
          </p>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="h-5 w-48" />
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
        <h1 className="text-xl font-semibold">Vendors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a vendor to view invoices and create cashout offers
        </p>
      </div>

      {!vendors || vendors.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Store className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No vendors found. Upload invoices to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {vendors.map((vendor) => (
            <Link
              key={vendor.id}
              href={`/restaurants/${restaurantId}/vendors/${vendor.id}`}
            >
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-md bg-accent">
                      <Store className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        data-testid={`text-vendor-name-${vendor.id}`}
                      >
                        {vendor.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vendor.invoiceCount} invoices
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        ${Number(vendor.totalAmount).toLocaleString()}
                      </p>
                      {vendor.eligibleCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {vendor.eligibleCount} eligible
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

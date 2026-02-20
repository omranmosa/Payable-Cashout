import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Send, Package } from "lucide-react";

type OutstandingDelivery = {
  id: string;
  externalDeliveryId: string | null;
  counterpartyId: string;
  vendorMasterId: string;
  deliveryDate: string;
  amountEarned: string | null;
  status: string;
};

type PricingEstimate = {
  sarPerDelivery: string;
  feeTotal: string;
  netPayout: string;
};

function formatSAR(val: string | number | null | undefined) {
  if (val === null || val === undefined) return "-";
  return Number(val).toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RequestCashoutPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: deliveries, isLoading } = useQuery<OutstandingDelivery[]>({
    queryKey: ["/api/delivery-records/outstanding"],
  });

  const items = deliveries || [];
  const selectedCount = selectedIds.size;
  const totalAmount = useMemo(() => {
    return items
      .filter((d) => selectedIds.has(d.id))
      .reduce((sum, d) => sum + (d.amountEarned ? Number(d.amountEarned) : 0), 0);
  }, [items, selectedIds]);

  const vendorMasterId = user?.vendorMasterId || items[0]?.vendorMasterId || "";

  const { data: estimate } = useQuery<PricingEstimate>({
    queryKey: ["/api/pricing-estimate", vendorMasterId, String(selectedCount)],
    queryFn: async () => {
      if (!vendorMasterId || selectedCount === 0) return { sarPerDelivery: "0", feeTotal: "0", netPayout: "0" };
      const res = await fetch(`/api/pricing-estimate?vendorMasterId=${vendorMasterId}&deliveryCount=${selectedCount}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch estimate");
      return res.json();
    },
    enabled: selectedCount > 0 && !!vendorMasterId,
  });

  const submitMutation = useMutation({
    mutationFn: async (deliveryRecordIds: string[]) => {
      await apiRequest("POST", "/api/cashouts", { deliveryRecordIds });
    },
    onSuccess: () => {
      toast({ title: "Cashout request submitted" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-records/outstanding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashouts"] });
      navigate("/cashouts");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((d) => d.id)));
    }
  }

  function handleSubmit() {
    submitMutation.mutate(Array.from(selectedIds));
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Request Cashout</h1>
          <p className="text-sm text-muted-foreground mt-1">Select deliveries for cashout</p>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Request Cashout</h1>
        <p className="text-sm text-muted-foreground mt-1">Select outstanding deliveries to include in your cashout request</p>
      </div>

      {selectedCount > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Selected Deliveries</p>
                <p className="font-medium text-lg" data-testid="text-selected-count">{selectedCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="font-medium text-lg" data-testid="text-total-amount">{formatSAR(totalAmount)} SAR</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estimated Fee</p>
                <p className="font-medium text-lg" data-testid="text-estimated-fee">
                  {estimate ? formatSAR(estimate.feeTotal) : "-"} SAR
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Payout</p>
                <p className="font-medium text-lg" data-testid="text-net-payout">
                  {estimate ? formatSAR(estimate.netPayout) : "-"} SAR
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No outstanding deliveries available for cashout.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left">
                      <Checkbox
                        checked={selectedIds.size === items.length && items.length > 0}
                        onCheckedChange={toggleAll}
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">External ID</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Delivery Date</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Amount (SAR)</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((delivery) => (
                    <tr
                      key={delivery.id}
                      className="border-b last:border-0"
                      data-testid={`row-delivery-${delivery.id}`}
                    >
                      <td className="p-3">
                        <Checkbox
                          checked={selectedIds.has(delivery.id)}
                          onCheckedChange={() => toggleSelect(delivery.id)}
                          data-testid={`checkbox-delivery-${delivery.id}`}
                        />
                      </td>
                      <td className="p-3 font-medium" data-testid={`text-external-id-${delivery.id}`}>
                        {delivery.externalDeliveryId || "-"}
                      </td>
                      <td className="p-3" data-testid={`text-delivery-date-${delivery.id}`}>
                        {delivery.deliveryDate}
                      </td>
                      <td className="p-3 text-right font-medium" data-testid={`text-amount-${delivery.id}`}>
                        {formatSAR(delivery.amountEarned)}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30" data-testid={`badge-status-${delivery.id}`}>
                          {delivery.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <div className="flex justify-end">
          <Button
            disabled={selectedCount === 0 || submitMutation.isPending}
            onClick={handleSubmit}
            data-testid="button-submit-cashout"
          >
            <Send className="w-4 h-4 mr-2" />
            {submitMutation.isPending ? "Submitting..." : "Submit Cashout Request"}
          </Button>
        </div>
      )}
    </div>
  );
}

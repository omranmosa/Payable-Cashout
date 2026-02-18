import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, DollarSign, Send } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";

type InvoiceItem = {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  amountRemaining: string;
  isEligible: boolean;
  status: string | null;
  restaurantId: string;
};

type FeeRate = {
  id: string;
  label: string;
  minDays: number;
  maxDays: number;
  ratePer30d: string;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function VendorRequestCashoutPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [advanceAmount, setAdvanceAmount] = useState("");

  const { data: invoicesRaw, isLoading: invoicesLoading } = useQuery<InvoiceItem[]>({
    queryKey: ["/api/vendors", user?.vendorId, "invoices"],
    enabled: !!user?.vendorId,
  });

  const { data: feeRates } = useQuery<FeeRate[]>({
    queryKey: ["/api/fee-rates"],
  });

  const eligibleInvoices = useMemo(() => {
    return (invoicesRaw || []).filter(i => i.isEligible);
  }, [invoicesRaw]);

  const totalSelected = useMemo(() => {
    return eligibleInvoices
      .filter(i => selectedIds.has(i.id))
      .reduce((s, i) => s + Number(i.amountRemaining), 0);
  }, [eligibleInvoices, selectedIds]);

  const estimatedFee = useMemo(() => {
    const amt = Number(advanceAmount) || 0;
    if (amt <= 0 || totalSelected <= 0) return 0;
    const rates = feeRates || [];
    let totalFee = 0;
    const selected = eligibleInvoices.filter(i => selectedIds.has(i.id));
    for (const inv of selected) {
      const daysTodue = Math.max(0, Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      const matchingRate = rates.find(r => daysTodue >= r.minDays && daysTodue <= r.maxDays);
      const rate = matchingRate ? Number(matchingRate.ratePer30d) : 0.015;
      const invAmt = Number(inv.amountRemaining);
      totalFee += invAmt * rate * (daysTodue / 30);
    }
    const proportion = amt / totalSelected;
    return totalFee * proportion;
  }, [advanceAmount, totalSelected, eligibleInvoices, selectedIds, feeRates]);

  const netAmount = (Number(advanceAmount) || 0) - estimatedFee;

  const toggleInvoice = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === eligibleInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleInvoices.map(i => i.id)));
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const selected = eligibleInvoices.filter(i => selectedIds.has(i.id));
      if (selected.length === 0) throw new Error("No invoices selected");
      const restaurantId = selected[0].restaurantId;

      await apiRequest("POST", "/api/offers", {
        restaurantId,
        vendorId: user?.vendorId,
        invoiceIds: Array.from(selectedIds),
        advanceAmount: Number(advanceAmount),
      });
    },
    onSuccess: () => {
      toast({ title: "Cashout Requested", description: "Your cashout request has been submitted." });
      queryClient.invalidateQueries({ queryKey: ["/api/offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      setLocation("/cashouts");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (invoicesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/cashouts">
          <Button size="icon" variant="ghost" data-testid="button-back-cashouts">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold" data-testid="heading-request-cashout">Request Cashout</h1>
          <p className="text-sm text-muted-foreground mt-1">Select eligible invoices and request early payment</p>
        </div>
      </div>

      {eligibleInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No eligible invoices available for cashout</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div>
            <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
              <h2 className="text-base font-semibold">Eligible Invoices</h2>
              <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all">
                {selectedIds.size === eligibleInvoices.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="space-y-2">
              {eligibleInvoices.map((inv) => {
                const daysTodue = Math.max(0, Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                return (
                  <Card key={inv.id} className={`cursor-pointer ${selectedIds.has(inv.id) ? "ring-2 ring-primary" : ""}`} data-testid={`card-invoice-${inv.id}`}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedIds.has(inv.id)}
                          onCheckedChange={() => toggleInvoice(inv.id)}
                          data-testid={`checkbox-invoice-${inv.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">Due {new Date(inv.dueDate).toLocaleDateString()} ({daysTodue} days)</p>
                        </div>
                        <p className="text-sm font-semibold">{formatCurrency(Number(inv.amountRemaining))}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Card>
            <CardContent className="py-4 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap text-sm">
                <span className="text-muted-foreground">Selected Total</span>
                <span className="font-semibold" data-testid="text-selected-total">{formatCurrency(totalSelected)}</span>
              </div>
              <div>
                <Label className="text-xs">Cashout Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={totalSelected}
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="Enter amount to cash out"
                  data-testid="input-cashout-amount"
                />
                {totalSelected > 0 && (
                  <Button variant="ghost" className="text-xs" onClick={() => setAdvanceAmount(String(totalSelected))} data-testid="button-max-amount">
                    Use max: {formatCurrency(totalSelected)}
                  </Button>
                )}
              </div>
              {Number(advanceAmount) > 0 && (
                <div className="space-y-2 text-sm border-t pt-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-muted-foreground">Estimated Fee</span>
                    <span className="font-medium text-destructive" data-testid="text-estimated-fee">{formatCurrency(estimatedFee)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-muted-foreground">Net Cashout</span>
                    <span className="font-bold text-lg" data-testid="text-net-cashout">{formatCurrency(netAmount)}</span>
                  </div>
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => mutation.mutate()}
                disabled={selectedIds.size === 0 || !advanceAmount || Number(advanceAmount) <= 0 || Number(advanceAmount) > totalSelected || mutation.isPending}
                data-testid="button-submit-cashout"
              >
                <Send className="w-4 h-4 mr-2" />
                {mutation.isPending ? "Submitting..." : "Request Cashout"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

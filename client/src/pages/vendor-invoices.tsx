import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useParams, useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, DollarSign, Search, Filter } from "lucide-react";
import type { Invoice, Vendor } from "@shared/schema";
import { Link } from "wouter";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function VendorInvoicesPage() {
  const params = useParams<{ id: string; vendorId: string }>();
  const { id: restaurantId, vendorId } = params;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState<string>("all");
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [showCashout, setShowCashout] = useState(false);

  const { data: vendor } = useQuery<Vendor>({
    queryKey: ["/api/vendors", vendorId],
  });

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/vendors", vendorId, "invoices"],
  });

  const { data: restaurants } = useQuery<any[]>({
    queryKey: ["/api/restaurants"],
  });

  const actualRestaurantId = restaurants?.[0]?.id || restaurantId;

  const createOfferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/offers", {
        restaurantId: actualRestaurantId,
        vendorId,
        invoiceIds: Array.from(selectedInvoices),
        advanceAmount: parseFloat(advanceAmount),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Offer Created", description: "Review your offer details." });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      navigate(`/offers/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = (invoices || []).filter((inv) => {
    const matchSearch =
      !searchTerm ||
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchEligibility =
      eligibilityFilter === "all" ||
      (eligibilityFilter === "eligible" && inv.isEligible) ||
      (eligibilityFilter === "ineligible" && !inv.isEligible);
    return matchSearch && matchEligibility;
  });

  const selectedEligible = filtered.filter(
    (inv) => selectedInvoices.has(inv.id) && inv.isEligible
  );
  const maxAdvance = selectedEligible.reduce(
    (sum, inv) => sum + Number(inv.amountRemaining),
    0
  );

  const toggleInvoice = (id: string) => {
    setSelectedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const eligibleFiltered = filtered.filter((inv) => inv.isEligible);
    if (eligibleFiltered.every((inv) => selectedInvoices.has(inv.id))) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(eligibleFiltered.map((inv) => inv.id)));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/restaurants/${restaurantId}/vendors`}>
          <Button size="icon" variant="ghost">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-vendor-title">
            {vendor?.name || "Vendor"} Invoices
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} invoices &middot;{" "}
            {filtered.filter((i) => i.isEligible).length} eligible
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-invoices"
          />
        </div>
        <Select value={eligibilityFilter} onValueChange={setEligibilityFilter}>
          <SelectTrigger className="w-40" data-testid="select-eligibility-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="eligible">Eligible</SelectItem>
            <SelectItem value="ineligible">Ineligible</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-3 text-left w-10">
                    <Checkbox
                      checked={
                        filtered.filter((i) => i.isEligible).length > 0 &&
                        filtered
                          .filter((i) => i.isEligible)
                          .every((i) => selectedInvoices.has(i.id))
                      }
                      onCheckedChange={toggleAll}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                    Invoice #
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                    Due Date
                  </th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">
                    Amount
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="p-3 text-center text-xs font-medium text-muted-foreground">
                    Eligible
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No invoices match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv) => {
                    const daysUntilDue = Math.ceil(
                      (new Date(inv.dueDate).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    );
                    return (
                      <tr
                        key={inv.id}
                        className="border-b last:border-0"
                        data-testid={`row-invoice-${inv.id}`}
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={selectedInvoices.has(inv.id)}
                            onCheckedChange={() => toggleInvoice(inv.id)}
                            disabled={!inv.isEligible}
                            data-testid={`checkbox-invoice-${inv.id}`}
                          />
                        </td>
                        <td className="p-3 font-medium">
                          {inv.invoiceNumber}
                        </td>
                        <td className="p-3">
                          <span className="text-muted-foreground">
                            {new Date(inv.dueDate).toLocaleDateString()}
                          </span>
                          {daysUntilDue < 0 && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Overdue
                            </Badge>
                          )}
                          {daysUntilDue >= 0 && daysUntilDue <= 7 && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {daysUntilDue}d
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(Number(inv.amountRemaining))}
                        </td>
                        <td className="p-3">
                          {inv.status && (
                            <Badge variant="outline" className="text-xs">
                              {inv.status}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {inv.isEligible ? (
                            <Badge variant="default" className="text-xs">
                              Eligible
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Ineligible
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedEligible.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold">Create Cashout Offer</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedEligible.length} invoices selected &middot; Max advance:{" "}
                  {formatCurrency(maxAdvance)}
                </p>
              </div>
              <Button
                onClick={() => setShowCashout(!showCashout)}
                data-testid="button-toggle-cashout"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                {showCashout ? "Hide" : "Cashout"}
              </Button>
            </div>
          </CardHeader>
          {showCashout && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Advance Amount (max {formatCurrency(maxAdvance)})</Label>
                <Input
                  type="number"
                  step="0.01"
                  max={maxAdvance}
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="Enter advance amount"
                  data-testid="input-advance-amount"
                />
              </div>
              <Button
                className="w-full"
                disabled={
                  !advanceAmount ||
                  parseFloat(advanceAmount) <= 0 ||
                  parseFloat(advanceAmount) > maxAdvance ||
                  createOfferMutation.isPending
                }
                onClick={() => createOfferMutation.mutate()}
                data-testid="button-create-offer"
              >
                {createOfferMutation.isPending
                  ? "Creating..."
                  : "Create Offer"}
              </Button>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

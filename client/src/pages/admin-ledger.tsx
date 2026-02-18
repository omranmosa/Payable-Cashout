import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, ArrowUpRight, ArrowDownLeft } from "lucide-react";

type LedgerItem = {
  id: string;
  offerId: string;
  type: string;
  amount: string;
  date: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  vendorName: string;
  offerStatus: string;
  totalRepayment: string;
  totalPaid: string;
  isOverdue: boolean;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function AdminLedgerPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [entryType, setEntryType] = useState("payout");
  const [entryOfferId, setEntryOfferId] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [entryMethod, setEntryMethod] = useState("");
  const [entryReference, setEntryReference] = useState("");

  const { data: ledgerData, isLoading } = useQuery<{
    entries: LedgerItem[];
    offers: Array<{ id: string; vendorName: string; status: string }>;
  }>({
    queryKey: ["/api/admin/ledger"],
  });

  const createEntryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/ledger", {
        offerId: entryOfferId,
        type: entryType,
        amount: parseFloat(entryAmount),
        date: entryDate,
        method: entryMethod || null,
        reference: entryReference || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Entry Recorded" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setDialogOpen(false);
      setEntryAmount("");
      setEntryMethod("");
      setEntryReference("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Admin Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Payouts and repayments
          </p>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const entries = ledgerData?.entries || [];
  const offers = ledgerData?.offers || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Admin Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track payouts and repayments
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-entry">
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Ledger Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={entryType} onValueChange={setEntryType}>
                  <SelectTrigger data-testid="select-entry-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payout">Payout</SelectItem>
                    <SelectItem value="repayment">Repayment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Offer</Label>
                <Select value={entryOfferId} onValueChange={setEntryOfferId}>
                  <SelectTrigger data-testid="select-entry-offer">
                    <SelectValue placeholder="Select offer" />
                  </SelectTrigger>
                  <SelectContent>
                    {offers.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.vendorName} ({o.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-entry-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  data-testid="input-entry-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Input
                  value={entryMethod}
                  onChange={(e) => setEntryMethod(e.target.value)}
                  placeholder="Wire, ACH, Check..."
                  data-testid="input-entry-method"
                />
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input
                  value={entryReference}
                  onChange={(e) => setEntryReference(e.target.value)}
                  placeholder="Transaction ID"
                  data-testid="input-entry-reference"
                />
              </div>
              <Button
                className="w-full"
                disabled={
                  !entryOfferId ||
                  !entryAmount ||
                  createEntryMutation.isPending
                }
                onClick={() => createEntryMutation.mutate()}
                data-testid="button-submit-entry"
              >
                {createEntryMutation.isPending
                  ? "Saving..."
                  : "Record Entry"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No ledger entries yet. Accept an offer and record payouts here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                      Vendor
                    </th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                      Method
                    </th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                      Reference
                    </th>
                    <th className="p-3 text-center text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b last:border-0"
                      data-testid={`row-ledger-${entry.id}`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {entry.type === "payout" ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />
                          ) : (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-chart-2" />
                          )}
                          <span className="font-medium capitalize">
                            {entry.type}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">{entry.vendorName}</td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(Number(entry.amount))}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {entry.method || "-"}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {entry.reference || "-"}
                      </td>
                      <td className="p-3 text-center">
                        {entry.isOverdue ? (
                          <Badge variant="destructive" className="text-xs">
                            Overdue
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {entry.offerStatus}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

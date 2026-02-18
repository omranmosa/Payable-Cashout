import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Banknote, Send, DollarSign, Paperclip } from "lucide-react";
import { useState, useRef } from "react";

type FinancedItem = {
  id: string;
  vendorName: string;
  advanceAmount: string;
  feeAmount: string;
  totalRepayment: string;
  totalRepaid: string;
  repaymentDate: string | null;
  status: string;
  createdAt: string;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function RepaymentForm({ item, onClose }: { item: FinancedItem; onClose: () => void }) {
  const { toast } = useToast();
  const remaining = Number(item.totalRepayment) - Number(item.totalRepaid);
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("amount", String(remaining));
      formData.append("reference", reference);
      formData.append("method", "bank_transfer");
      if (file) {
        formData.append("file", file);
      }
      const res = await fetch(`/api/financing/${item.id}/repayment`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to submit repayment");
      }
    },
    onSuccess: () => {
      toast({ title: "Repayment Submitted", description: "Your transfer has been recorded." });
      queryClient.invalidateQueries({ queryKey: ["/api/financing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className="mt-3">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground">Repayment amount</p>
            <p className="text-lg font-bold">{formatCurrency(remaining)}</p>
          </div>
        </div>
        <div>
          <Label className="text-xs">Transfer Reference / Confirmation Number</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. Wire transfer #12345"
            data-testid="input-repayment-reference"
          />
        </div>
        <div>
          <Label className="text-xs">Attach File (optional)</Label>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            data-testid="input-repayment-file"
          />
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-attach-file"
            >
              <Paperclip className="w-4 h-4 mr-2" />
              {file ? file.name : "Choose File"}
            </Button>
            {file && (
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} data-testid="button-remove-file">
                Remove
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            data-testid="button-submit-repayment"
          >
            <Send className="w-4 h-4 mr-2" />
            {mutation.isPending ? "Submitting..." : "Submit Repayment"}
          </Button>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-repayment">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinancingPage() {
  const [repayingId, setRepayingId] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery<FinancedItem[]>({
    queryKey: ["/api/financing"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const awaiting = items?.filter(i => i.status === "payout_sent") || [];
  const completed = items?.filter(i => ["repaid", "closed"].includes(i.status)) || [];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold" data-testid="heading-financing">Financing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View financed items and submit repayments
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Awaiting Repayment</h2>
        {awaiting.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Banknote className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No outstanding repayments</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {awaiting.map((item) => {
              const remaining = Number(item.totalRepayment) - Number(item.totalRepaid);
              return (
                <div key={item.id}>
                  <Card data-testid={`card-financing-${item.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                        <div>
                          <p className="font-medium text-sm" data-testid={`text-financing-vendor-${item.id}`}>{item.vendorName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString()}
                            {item.repaymentDate && ` \u00b7 Due ${new Date(item.repaymentDate).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-chart-4/10 text-chart-4">
                          Awaiting Repayment
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Advance</p>
                          <p className="font-semibold">{formatCurrency(Number(item.advanceAmount))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Fee</p>
                          <p className="font-semibold">{formatCurrency(Number(item.feeAmount))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Due</p>
                          <p className="font-semibold">{formatCurrency(Number(item.totalRepayment))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Remaining</p>
                          <p className="font-semibold">{formatCurrency(remaining)}</p>
                        </div>
                      </div>
                      {repayingId !== item.id && (
                        <Button
                          className="mt-3"
                          onClick={() => setRepayingId(item.id)}
                          data-testid={`button-repay-${item.id}`}
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          Submit Repayment
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                  {repayingId === item.id && (
                    <RepaymentForm item={item} onClose={() => setRepayingId(null)} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {completed.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Completed</h2>
          <div className="space-y-2">
            {completed.map((item) => (
              <Card key={item.id} data-testid={`card-financing-completed-${item.id}`}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-medium text-sm">{item.vendorName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm">
                        <p className="font-semibold">{formatCurrency(Number(item.totalRepayment))}</p>
                      </div>
                      <Badge variant="secondary" className="bg-chart-2/10 text-chart-2">Repaid</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

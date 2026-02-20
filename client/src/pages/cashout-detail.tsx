import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X, CreditCard, CheckCircle } from "lucide-react";

type CashoutAllocationRow = {
  id: string;
  counterpartyName?: string;
  deliveriesCount: number;
  cashoutAmountPortion: string;
  feePortion: string;
  totalPayableToUs: string;
};

type DeliveryRecordRow = {
  id: string;
  externalDeliveryId: string | null;
  deliveryDate: string;
  amountEarned: string | null;
  status: string;
};

type CashoutDetail = {
  id: string;
  vendorMasterId: string;
  vendorName?: string;
  vendorCrn?: string;
  cashoutAmount: string;
  deliveriesCount: number;
  sarPerDeliveryApplied: string;
  feeTotal: string;
  netPaidToVendor: string;
  status: string;
  createdAt: string;
  acceptedAt: string | null;
  paidOutAt: string | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  allocations?: CashoutAllocationRow[];
  deliveryRecords?: DeliveryRecordRow[];
};

function cashoutStatusBadge(status: string) {
  const styles: Record<string, string> = {
    REQUESTED: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    COUNTERPARTY_APPROVED: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    ADMIN_APPROVED: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
    PAID_OUT: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
    SETTLED: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/30",
    REJECTED: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={styles[status] || ""} data-testid="badge-cashout-status">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function formatSAR(val: string | null | undefined) {
  if (!val) return "-";
  return Number(val).toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(val: string | null | undefined) {
  if (!val) return "-";
  return new Date(val).toLocaleDateString("en-SA");
}

function formatDateTime(val: string | null | undefined) {
  if (!val) return "-";
  return new Date(val).toLocaleString("en-SA");
}

export default function CashoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const { data: cashout, isLoading } = useQuery<CashoutDetail>({
    queryKey: ["/api/cashouts", id],
  });

  function makeActionMutation(actionUrl: string, successMessage: string) {
    return {
      mutationFn: async (body?: Record<string, string> | undefined) => {
        await apiRequest("POST", actionUrl, body || undefined);
      },
      onSuccess: () => {
        toast({ title: successMessage });
        queryClient.invalidateQueries({ queryKey: ["/api/cashouts", id] });
        queryClient.invalidateQueries({ queryKey: ["/api/cashouts"] });
      },
      onError: (err: Error) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    };
  }

  const counterpartyApproveMutation = useMutation(
    makeActionMutation(`/api/cashouts/${id}/counterparty-approve`, "Cashout approved")
  );
  const counterpartyRejectMutation = useMutation(
    makeActionMutation(`/api/cashouts/${id}/counterparty-reject`, "Cashout rejected")
  );
  const adminApproveMutation = useMutation(
    makeActionMutation(`/api/cashouts/${id}/admin-approve`, "Cashout admin approved")
  );
  const adminRejectMutation = useMutation(
    makeActionMutation(`/api/cashouts/${id}/admin-reject`, "Cashout rejected")
  );
  const markPayoutMutation = useMutation({
    ...makeActionMutation(`/api/cashouts/${id}/mark-payout`, "Payout marked"),
    onSuccess: () => {
      toast({ title: "Payout marked" });
      queryClient.invalidateQueries({ queryKey: ["/api/cashouts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashouts"] });
      setPayoutDialogOpen(false);
      setPaymentReference("");
      setPaymentMethod("");
    },
  });
  const markSettledMutation = useMutation(
    makeActionMutation(`/api/cashouts/${id}/mark-settled`, "Cashout settled")
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!cashout) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground" data-testid="text-not-found">Cashout not found.</p>
      </div>
    );
  }

  const role = user?.role || "";
  const status = cashout.status;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/cashouts">
          <Button variant="ghost" size="icon" data-testid="button-back-cashouts">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold" data-testid="text-cashout-title">
            Cashout: {cashout.vendorName || "Vendor"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            CRN: {cashout.vendorCrn || "-"}
          </p>
        </div>
        {cashoutStatusBadge(status)}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <p className="text-sm font-medium">Cashout Details</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Cashout Amount</p>
              <p className="font-medium" data-testid="text-cashout-amount">{formatSAR(cashout.cashoutAmount)} SAR</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Deliveries Count</p>
              <p className="font-medium" data-testid="text-deliveries-count">{cashout.deliveriesCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">SAR/Delivery</p>
              <p className="font-medium" data-testid="text-sar-per-delivery">{Number(cashout.sarPerDeliveryApplied).toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fee Total</p>
              <p className="font-medium" data-testid="text-fee-total">{formatSAR(cashout.feeTotal)} SAR</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net Paid to Vendor</p>
              <p className="font-medium" data-testid="text-net-paid">{formatSAR(cashout.netPaidToVendor)} SAR</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm" data-testid="text-created-at">{formatDateTime(cashout.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Accepted</p>
              <p className="text-sm" data-testid="text-accepted-at">{formatDateTime(cashout.acceptedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid Out</p>
              <p className="text-sm" data-testid="text-paid-out-at">{formatDateTime(cashout.paidOutAt)}</p>
            </div>
            {cashout.paymentReference && (
              <div>
                <p className="text-xs text-muted-foreground">Payment Reference</p>
                <p className="text-sm" data-testid="text-payment-reference">{cashout.paymentReference}</p>
              </div>
            )}
            {cashout.paymentMethod && (
              <div>
                <p className="text-xs text-muted-foreground">Payment Method</p>
                <p className="text-sm" data-testid="text-payment-method">{cashout.paymentMethod}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        {role === "counterparty" && status === "REQUESTED" && (
          <>
            <Button
              onClick={() => counterpartyApproveMutation.mutate({})}
              disabled={counterpartyApproveMutation.isPending}
              data-testid="button-counterparty-approve"
            >
              <Check className="w-4 h-4 mr-2" />
              {counterpartyApproveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => counterpartyRejectMutation.mutate({})}
              disabled={counterpartyRejectMutation.isPending}
              data-testid="button-counterparty-reject"
            >
              <X className="w-4 h-4 mr-2" />
              {counterpartyRejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </>
        )}

        {role === "admin" && (status === "REQUESTED" || status === "COUNTERPARTY_APPROVED") && (
          <>
            <Button
              onClick={() => adminApproveMutation.mutate({})}
              disabled={adminApproveMutation.isPending}
              data-testid="button-admin-approve"
            >
              <Check className="w-4 h-4 mr-2" />
              {adminApproveMutation.isPending ? "Approving..." : "Admin Approve"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => adminRejectMutation.mutate({})}
              disabled={adminRejectMutation.isPending}
              data-testid="button-admin-reject"
            >
              <X className="w-4 h-4 mr-2" />
              {adminRejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </>
        )}

        {role === "admin" && status === "ADMIN_APPROVED" && (
          <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-mark-payout">
                <CreditCard className="w-4 h-4 mr-2" />
                Mark Payout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mark Payout</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Payment Reference</Label>
                  <Input
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Reference number"
                    data-testid="input-payment-reference"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Input
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="e.g. Bank Transfer, Wire"
                    data-testid="input-payment-method"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={markPayoutMutation.isPending}
                  onClick={() => markPayoutMutation.mutate({ paymentReference, paymentMethod })}
                  data-testid="button-submit-payout"
                >
                  {markPayoutMutation.isPending ? "Marking..." : "Confirm Payout"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {role === "admin" && status === "PAID_OUT" && (
          <Button
            onClick={() => markSettledMutation.mutate({})}
            disabled={markSettledMutation.isPending}
            data-testid="button-mark-settled"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {markSettledMutation.isPending ? "Settling..." : "Mark Settled"}
          </Button>
        )}
      </div>

      {cashout.allocations && cashout.allocations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-medium">Allocations</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Counterparty</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Deliveries</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Portion (SAR)</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Fee Portion (SAR)</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Total Payable (SAR)</th>
                  </tr>
                </thead>
                <tbody>
                  {cashout.allocations.map((alloc) => (
                    <tr key={alloc.id} className="border-b last:border-0" data-testid={`row-allocation-${alloc.id}`}>
                      <td className="p-3 font-medium" data-testid={`text-alloc-counterparty-${alloc.id}`}>
                        {alloc.counterpartyName || alloc.id}
                      </td>
                      <td className="p-3 text-right" data-testid={`text-alloc-deliveries-${alloc.id}`}>
                        {alloc.deliveriesCount}
                      </td>
                      <td className="p-3 text-right" data-testid={`text-alloc-portion-${alloc.id}`}>
                        {formatSAR(alloc.cashoutAmountPortion)}
                      </td>
                      <td className="p-3 text-right" data-testid={`text-alloc-fee-${alloc.id}`}>
                        {formatSAR(alloc.feePortion)}
                      </td>
                      <td className="p-3 text-right font-medium" data-testid={`text-alloc-total-${alloc.id}`}>
                        {formatSAR(alloc.totalPayableToUs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {cashout.deliveryRecords && cashout.deliveryRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-medium">Delivery Records</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">External ID</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Delivery Date</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Amount (SAR)</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cashout.deliveryRecords.map((dr) => (
                    <tr key={dr.id} className="border-b last:border-0" data-testid={`row-delivery-record-${dr.id}`}>
                      <td className="p-3" data-testid={`text-dr-external-id-${dr.id}`}>
                        {dr.externalDeliveryId || "-"}
                      </td>
                      <td className="p-3" data-testid={`text-dr-date-${dr.id}`}>
                        {dr.deliveryDate}
                      </td>
                      <td className="p-3 text-right font-medium" data-testid={`text-dr-amount-${dr.id}`}>
                        {formatSAR(dr.amountEarned)}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs" data-testid={`badge-dr-status-${dr.id}`}>
                          {dr.status}
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
    </div>
  );
}

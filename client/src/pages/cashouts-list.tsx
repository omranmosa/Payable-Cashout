import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote } from "lucide-react";

type CashoutRow = {
  id: string;
  vendorMasterId: string;
  cashoutAmount: string;
  deliveriesCount: number;
  sarPerDeliveryApplied: string;
  feeTotal: string;
  netPaidToVendor: string;
  status: string;
  createdAt: string;
  vendorName?: string;
  vendorCrn?: string;
  allocationsCount?: number;
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
    <Badge variant="outline" className={styles[status] || ""} data-testid={`badge-status-${status}`}>
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

export default function CashoutsListPage() {
  const { data: cashouts, isLoading } = useQuery<CashoutRow[]>({
    queryKey: ["/api/cashouts"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Cashouts</h1>
          <p className="text-sm text-muted-foreground mt-1">View cashout requests</p>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const items = cashouts || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Cashouts</h1>
        <p className="text-sm text-muted-foreground mt-1">View cashout requests and their status</p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Banknote className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No cashouts found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Vendor Name (CRN)</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Deliveries</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Cashout Amount (SAR)</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Fee (SAR)</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Net Paid (SAR)</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((cashout) => (
                    <tr
                      key={cashout.id}
                      className="border-b last:border-0 hover-elevate cursor-pointer"
                      data-testid={`row-cashout-${cashout.id}`}
                    >
                      <td className="p-3">
                        <Link href={`/cashouts/${cashout.id}`} data-testid={`link-cashout-${cashout.id}`}>
                          <span className="font-medium">{cashout.vendorName || "N/A"}</span>
                          {cashout.vendorCrn && (
                            <span className="text-muted-foreground text-xs ml-1">({cashout.vendorCrn})</span>
                          )}
                        </Link>
                      </td>
                      <td className="p-3 text-right" data-testid={`text-deliveries-count-${cashout.id}`}>
                        {cashout.deliveriesCount}
                      </td>
                      <td className="p-3 text-right font-medium" data-testid={`text-cashout-amount-${cashout.id}`}>
                        {formatSAR(cashout.cashoutAmount)}
                      </td>
                      <td className="p-3 text-right text-muted-foreground" data-testid={`text-fee-${cashout.id}`}>
                        {formatSAR(cashout.feeTotal)}
                      </td>
                      <td className="p-3 text-right font-medium" data-testid={`text-net-paid-${cashout.id}`}>
                        {formatSAR(cashout.netPaidToVendor)}
                      </td>
                      <td className="p-3">
                        {cashoutStatusBadge(cashout.status)}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs" data-testid={`text-created-${cashout.id}`}>
                        {formatDate(cashout.createdAt)}
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

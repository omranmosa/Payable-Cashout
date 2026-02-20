import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark } from "lucide-react";

type SettlementRow = {
  id: string;
  vendorName: string;
  vendorCrn: string;
  cashoutAmount: string;
  feeTotal: string;
  netPaidToVendor: string;
  myPortion: string;
  myFee: string;
  myTotalPayable: string;
  status: string;
  paidOutAt: string | null;
  createdAt: string;
};

function settlementStatusBadge(status: string) {
  const styles: Record<string, string> = {
    PAID_OUT: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
    SETTLED: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/30",
    COUNTERPARTY_APPROVED: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    ADMIN_APPROVED: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
    REQUESTED: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
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

export default function SettlementsPage() {
  const { data: settlements, isLoading } = useQuery<SettlementRow[]>({
    queryKey: ["/api/settlements"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Settlements</h1>
          <p className="text-sm text-muted-foreground mt-1">View settlement records</p>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const items = settlements || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Settlements</h1>
        <p className="text-sm text-muted-foreground mt-1">View financed and settled cashouts</p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Landmark className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No settlements found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Vendor</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">CRN</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">My Portion (SAR)</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">My Fee (SAR)</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Total Payable (SAR)</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Paid Out Date</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((settlement) => (
                    <tr
                      key={settlement.id}
                      className="border-b last:border-0"
                      data-testid={`row-settlement-${settlement.id}`}
                    >
                      <td className="p-3 font-medium" data-testid={`text-vendor-name-${settlement.id}`}>
                        {settlement.vendorName}
                      </td>
                      <td className="p-3 text-muted-foreground" data-testid={`text-vendor-crn-${settlement.id}`}>
                        {settlement.vendorCrn}
                      </td>
                      <td className="p-3 text-right font-medium" data-testid={`text-my-portion-${settlement.id}`}>
                        {formatSAR(settlement.myPortion)}
                      </td>
                      <td className="p-3 text-right text-muted-foreground" data-testid={`text-my-fee-${settlement.id}`}>
                        {formatSAR(settlement.myFee)}
                      </td>
                      <td className="p-3 text-right font-medium" data-testid={`text-total-payable-${settlement.id}`}>
                        {formatSAR(settlement.myTotalPayable)}
                      </td>
                      <td className="p-3">
                        {settlementStatusBadge(settlement.status)}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs" data-testid={`text-paid-out-date-${settlement.id}`}>
                        {formatDate(settlement.paidOutAt)}
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

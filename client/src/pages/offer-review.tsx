import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useParams, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  CheckCircle,
  Download,
  Copy,
  ArrowLeft,
  FileText,
  Calendar,
  DollarSign,
} from "lucide-react";

type OfferDetail = {
  id: string;
  restaurantName: string;
  vendorName: string;
  advanceAmount: string;
  feeAmount: string;
  totalRepayment: string;
  weightedDays: string;
  status: string;
  createdAt: string;
  acceptedAt: string | null;
  repaymentDate: string | null;
  assignments: Array<{
    invoiceNumber: string;
    assignedAmount: string;
    dueDate: string;
  }>;
  restaurant: {
    bankName: string | null;
    bankAccountNumber: string | null;
    bankRoutingNumber: string | null;
    bankAccountName: string | null;
  };
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function OfferReviewPage() {
  const params = useParams<{ id: string }>();
  const offerId = params.id;
  const { toast } = useToast();
  const { user } = useAuth();
  const canAccept = user?.role === "admin" || user?.role === "restaurant";

  const { data: offer, isLoading } = useQuery<OfferDetail>({
    queryKey: ["/api/offers", offerId],
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/offers/${offerId}/accept`);
    },
    onSuccess: () => {
      toast({ title: "Offer Accepted" });
      queryClient.invalidateQueries({ queryKey: ["/api/offers", offerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const generateEmailText = () => {
    if (!offer) return "";
    return `Subject: Assignment Notice - ${offer.vendorName}

Dear ${offer.vendorName},

This notice confirms the assignment of the following invoices:

${offer.assignments.map((a) => `  - Invoice ${a.invoiceNumber}: ${formatCurrency(Number(a.assignedAmount))} (Due: ${new Date(a.dueDate).toLocaleDateString()})`).join("\n")}

Total Advance: ${formatCurrency(Number(offer.advanceAmount))}
Fee: ${formatCurrency(Number(offer.feeAmount))}
Repayment Amount: ${formatCurrency(Number(offer.totalRepayment))}
${offer.repaymentDate ? `Repayment Date: ${new Date(offer.repaymentDate).toLocaleDateString()}` : ""}

Bank Details:
  Bank: ${offer.restaurant.bankName || "N/A"}
  Account: ${offer.restaurant.bankAccountNumber || "N/A"}
  Routing: ${offer.restaurant.bankRoutingNumber || "N/A"}
  Name: ${offer.restaurant.bankAccountName || "N/A"}

Regards,
${offer.restaurantName}`;
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(generateEmailText());
    toast({ title: "Copied", description: "Email text copied to clipboard." });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Offer not found.</p>
      </div>
    );
  }

  const statusColor =
    offer.status === "accepted"
      ? "bg-chart-2/10 text-chart-2"
      : offer.status === "pending"
        ? "bg-chart-4/10 text-chart-4"
        : "bg-muted text-muted-foreground";

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/offers">
          <Button size="icon" variant="ghost">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold" data-testid="text-offer-title">
            Offer Review
          </h1>
          <p className="text-sm text-muted-foreground">
            {offer.vendorName} &middot; {offer.restaurantName}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-md font-medium ${statusColor}`} data-testid="text-offer-status">
          {offer.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Advance</p>
            </div>
            <p className="text-lg font-bold" data-testid="text-advance-amount">
              {formatCurrency(Number(offer.advanceAmount))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Fee</p>
            </div>
            <p className="text-lg font-bold" data-testid="text-fee-amount">
              {formatCurrency(Number(offer.feeAmount))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Repayment</p>
            </div>
            <p className="text-lg font-bold" data-testid="text-total-repayment">
              {formatCurrency(Number(offer.totalRepayment))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold">Assigned Invoices</h3>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                    Invoice #
                  </th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">
                    Assigned
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {offer.assignments.map((a, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-3 font-medium">{a.invoiceNumber}</td>
                    <td className="p-3 text-right">
                      {formatCurrency(Number(a.assignedAmount))}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(a.dueDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold">Summary</h3>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Weighted days to due</span>
            <span>{Number(offer.weightedDays).toFixed(1)} days</span>
          </div>
          {offer.repaymentDate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Repayment date</span>
              <span>
                {new Date(offer.repaymentDate).toLocaleDateString()}
              </span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-sm font-medium">
            <span>Net payout</span>
            <span>
              {formatCurrency(
                Number(offer.advanceAmount) - Number(offer.feeAmount)
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        {offer.status === "pending" && canAccept && (
          <Button
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            data-testid="button-accept-offer"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {acceptMutation.isPending ? "Accepting..." : "Accept Offer"}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => window.open(`/api/offers/${offerId}/pdf`, "_blank")}
          data-testid="button-download-pdf"
        >
          <Download className="w-4 h-4 mr-2" />
          Download PDF
        </Button>
        <Button variant="outline" onClick={copyEmail} data-testid="button-copy-email">
          <Copy className="w-4 h-4 mr-2" />
          Copy Email
        </Button>
      </div>
    </div>
  );
}

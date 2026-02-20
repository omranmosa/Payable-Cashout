import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Package } from "lucide-react";
import type { Counterparty, VendorMaster } from "@shared/schema";

type DeliveryRecordRow = {
  id: string;
  externalDeliveryId: string | null;
  counterpartyId: string;
  vendorMasterId: string;
  deliveryDate: string;
  amountEarned: string | null;
  status: string;
  createdAt: string;
};

function statusBadge(status: string) {
  switch (status) {
    case "OUTSTANDING":
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30" data-testid={`badge-status-${status}`}>{status}</Badge>;
    case "IN_CASHOUT":
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" data-testid={`badge-status-${status}`}>{status}</Badge>;
    case "SETTLED":
      return <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30" data-testid={`badge-status-${status}`}>{status}</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  }
}

function formatSAR(val: string | null | undefined) {
  if (!val) return "-";
  return Number(val).toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DeliveryRecordsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [counterpartyId, setCounterpartyId] = useState("");
  const [vendorMasterId, setVendorMasterId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [amountEarned, setAmountEarned] = useState("");
  const [externalDeliveryId, setExternalDeliveryId] = useState("");

  const canUpload = user?.role === "admin" || user?.role === "counterparty";

  const { data: records, isLoading } = useQuery<DeliveryRecordRow[]>({
    queryKey: ["/api/delivery-records"],
  });

  const { data: counterparties } = useQuery<Counterparty[]>({
    queryKey: ["/api/counterparties"],
    enabled: canUpload,
  });

  const { data: vendorMasters } = useQuery<VendorMaster[]>({
    queryKey: ["/api/vendor-masters"],
    enabled: canUpload,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      counterpartyId: string;
      vendorMasterId: string;
      deliveryDate: string;
      amountEarned: string;
      externalDeliveryId: string;
    }) => {
      await apiRequest("POST", "/api/delivery-records", data);
    },
    onSuccess: () => {
      toast({ title: "Delivery record created" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-records"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setCounterpartyId("");
    setVendorMasterId("");
    setDeliveryDate("");
    setAmountEarned("");
    setExternalDeliveryId("");
  }

  function handleSubmit() {
    createMutation.mutate({
      counterpartyId,
      vendorMasterId,
      deliveryDate,
      amountEarned,
      externalDeliveryId,
    });
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Delivery Records</h1>
          <p className="text-sm text-muted-foreground mt-1">View delivery records</p>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const items = records || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Delivery Records</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage delivery records</p>
        </div>
        {canUpload && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-deliveries">
                <Plus className="w-4 h-4 mr-2" />
                Upload Deliveries
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Delivery Record</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Counterparty</Label>
                  <Select value={counterpartyId} onValueChange={setCounterpartyId}>
                    <SelectTrigger data-testid="select-counterparty">
                      <SelectValue placeholder="Select counterparty" />
                    </SelectTrigger>
                    <SelectContent>
                      {(counterparties || []).map((cp) => (
                        <SelectItem key={cp.id} value={cp.id} data-testid={`option-counterparty-${cp.id}`}>
                          {cp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vendor Master</Label>
                  <Select value={vendorMasterId} onValueChange={setVendorMasterId}>
                    <SelectTrigger data-testid="select-vendor-master">
                      <SelectValue placeholder="Select vendor master" />
                    </SelectTrigger>
                    <SelectContent>
                      {(vendorMasters || []).map((vm) => (
                        <SelectItem key={vm.id} value={vm.id} data-testid={`option-vendor-master-${vm.id}`}>
                          {vm.legalName} ({vm.crn})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Delivery Date</Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    data-testid="input-delivery-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount Earned (SAR)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amountEarned}
                    onChange={(e) => setAmountEarned(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-amount-earned"
                  />
                </div>
                <div className="space-y-2">
                  <Label>External Delivery ID</Label>
                  <Input
                    value={externalDeliveryId}
                    onChange={(e) => setExternalDeliveryId(e.target.value)}
                    placeholder="External reference"
                    data-testid="input-external-delivery-id"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!counterpartyId || !vendorMasterId || !deliveryDate || createMutation.isPending}
                  onClick={handleSubmit}
                  data-testid="button-submit-delivery"
                >
                  {createMutation.isPending ? "Creating..." : "Create Delivery Record"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No delivery records found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">External ID</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Counterparty ID</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Vendor Master ID</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Delivery Date</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Amount (SAR)</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((rec) => (
                    <tr key={rec.id} className="border-b last:border-0" data-testid={`row-delivery-${rec.id}`}>
                      <td className="p-3 font-medium" data-testid={`text-external-id-${rec.id}`}>
                        {rec.externalDeliveryId || "-"}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs" data-testid={`text-counterparty-${rec.id}`}>
                        {rec.counterpartyId}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs" data-testid={`text-vendor-master-${rec.id}`}>
                        {rec.vendorMasterId}
                      </td>
                      <td className="p-3" data-testid={`text-delivery-date-${rec.id}`}>
                        {rec.deliveryDate}
                      </td>
                      <td className="p-3 text-right font-medium" data-testid={`text-amount-${rec.id}`}>
                        {formatSAR(rec.amountEarned)}
                      </td>
                      <td className="p-3">
                        {statusBadge(rec.status)}
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

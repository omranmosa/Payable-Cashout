import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { Plus, Link2 } from "lucide-react";
import type { VendorCounterpartyMapping, Counterparty, VendorMaster } from "@shared/schema";

export default function AdminMappingsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [counterpartyId, setCounterpartyId] = useState("");
  const [mappingCrn, setMappingCrn] = useState("");
  const [counterpartyVendorRef, setCounterpartyVendorRef] = useState("");

  const { data: mappings, isLoading } = useQuery<VendorCounterpartyMapping[]>({
    queryKey: ["/api/vendor-counterparty-mappings"],
  });

  const { data: counterparties } = useQuery<Counterparty[]>({
    queryKey: ["/api/counterparties"],
  });

  const { data: vendorMasters } = useQuery<VendorMaster[]>({
    queryKey: ["/api/vendor-masters"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      counterpartyId: string;
      crn: string;
      counterpartyVendorRef: string | null;
    }) => {
      await apiRequest("POST", "/api/vendor-counterparty-mappings", data);
    },
    onSuccess: () => {
      toast({ title: "Mapping created" });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-counterparty-mappings"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PUT", `/api/vendor-counterparty-mappings/${id}/status`, { status });
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-counterparty-mappings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setCounterpartyId("");
    setMappingCrn("");
    setCounterpartyVendorRef("");
  }

  function handleSubmit() {
    createMutation.mutate({
      counterpartyId,
      crn: mappingCrn,
      counterpartyVendorRef: counterpartyVendorRef || null,
    });
  }

  function getCounterpartyName(id: string | null) {
    if (!id) return "-";
    return counterparties?.find((c) => c.id === id)?.name || id;
  }

  function getVendorMasterName(id: string | null) {
    if (!id) return "-";
    return vendorMasters?.find((v) => v.id === id)?.legalName || id;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Vendor Mappings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage vendor-counterparty mappings</p>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const items = mappings || [];
  const cpList = counterparties || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Vendor Mappings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage vendor-counterparty mappings</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-mapping">
              <Plus className="w-4 h-4 mr-2" />
              Create Mapping
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Mapping</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Counterparty</Label>
                <Select value={counterpartyId} onValueChange={setCounterpartyId}>
                  <SelectTrigger data-testid="select-mapping-counterparty">
                    <SelectValue placeholder="Select counterparty" />
                  </SelectTrigger>
                  <SelectContent>
                    {cpList.map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {cp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CRN</Label>
                <Input
                  value={mappingCrn}
                  onChange={(e) => setMappingCrn(e.target.value)}
                  placeholder="Commercial Registration Number"
                  data-testid="input-mapping-crn"
                />
              </div>
              <div className="space-y-2">
                <Label>Counterparty Vendor Ref</Label>
                <Input
                  value={counterpartyVendorRef}
                  onChange={(e) => setCounterpartyVendorRef(e.target.value)}
                  placeholder="Vendor reference ID"
                  data-testid="input-mapping-vendor-ref"
                />
              </div>
              <Button
                className="w-full"
                disabled={!counterpartyId || !mappingCrn || createMutation.isPending}
                onClick={handleSubmit}
                data-testid="button-submit-mapping"
              >
                {createMutation.isPending ? "Creating..." : "Create Mapping"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Link2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No mappings yet. Create one to link counterparties to vendors.
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
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Counterparty</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">CRN</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Vendor Ref</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Vendor Master</th>
                    <th className="p-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b last:border-0"
                      data-testid={`row-mapping-${m.id}`}
                    >
                      <td className="p-3 font-medium" data-testid={`text-mapping-counterparty-${m.id}`}>
                        {getCounterpartyName(m.counterpartyId)}
                      </td>
                      <td className="p-3 text-muted-foreground" data-testid={`text-mapping-crn-${m.id}`}>
                        {m.crn || "-"}
                      </td>
                      <td className="p-3 text-muted-foreground" data-testid={`text-mapping-ref-${m.id}`}>
                        {m.counterpartyVendorRef || "-"}
                      </td>
                      <td className="p-3 text-muted-foreground" data-testid={`text-mapping-vendor-${m.id}`}>
                        {getVendorMasterName(m.vendorMasterId)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={m.status === "VERIFIED" ? "default" : "secondary"}
                          className="text-xs"
                          data-testid={`badge-mapping-status-${m.id}`}
                        >
                          {m.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {m.status === "VERIFIED" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: m.id, status: "UNVERIFIED" })}
                            data-testid={`button-unverify-${m.id}`}
                          >
                            Unverify
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: m.id, status: "VERIFIED" })}
                            data-testid={`button-verify-${m.id}`}
                          >
                            Verify
                          </Button>
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

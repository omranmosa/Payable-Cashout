import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { Plus, Store, ArrowLeft, Layers } from "lucide-react";
import type { VendorMaster, VendorPricingSchedule, VendorPricingTier } from "@shared/schema";

type PricingScheduleWithTiers = VendorPricingSchedule & {
  tiers: VendorPricingTier[];
};

function VendorPricingPage({ vendorMasterId }: { vendorMasterId: string }) {
  const { toast } = useToast();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [floorSar, setFloorSar] = useState("");
  const [pricingPeriodType] = useState("MONTHLY");
  const [tiers, setTiers] = useState([{ fromDeliveries: "0", toDeliveries: "", sarPerDelivery: "" }]);

  const { data: vendorMaster } = useQuery<VendorMaster>({
    queryKey: ["/api/vendor-masters", vendorMasterId],
  });

  const { data: schedules, isLoading } = useQuery<PricingScheduleWithTiers[]>({
    queryKey: ["/api/vendor-pricing", vendorMasterId],
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: {
      vendorMasterId: string;
      effectiveFrom: string;
      floorSarPerDelivery: string;
      pricingPeriodType: string;
      tiers: Array<{ fromDeliveries: number; toDeliveries: number | null; sarPerDelivery: string }>;
    }) => {
      await apiRequest("POST", "/api/vendor-pricing", data);
    },
    onSuccess: () => {
      toast({ title: "Pricing schedule created" });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-pricing", vendorMasterId] });
      setScheduleDialogOpen(false);
      setFloorSar("");
      setTiers([{ fromDeliveries: "0", toDeliveries: "", sarPerDelivery: "" }]);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function addTier() {
    setTiers([...tiers, { fromDeliveries: "", toDeliveries: "", sarPerDelivery: "" }]);
  }

  function updateTier(index: number, field: string, value: string) {
    const updated = [...tiers];
    updated[index] = { ...updated[index], [field]: value };
    setTiers(updated);
  }

  function removeTier(index: number) {
    if (tiers.length > 1) {
      setTiers(tiers.filter((_, i) => i !== index));
    }
  }

  function handleCreateSchedule() {
    createScheduleMutation.mutate({
      vendorMasterId,
      effectiveFrom,
      floorSarPerDelivery: floorSar,
      pricingPeriodType,
      tiers: tiers.map((t) => ({
        fromDeliveries: parseInt(t.fromDeliveries) || 0,
        toDeliveries: t.toDeliveries ? parseInt(t.toDeliveries) : null,
        sarPerDelivery: t.sarPerDelivery,
      })),
    });
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const items = schedules || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/admin/vendor-masters">
            <Button variant="ghost" size="icon" data-testid="button-back-vendors">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-pricing-title">
              Pricing: {vendorMaster?.legalName || "Vendor"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage pricing schedules and tiers</p>
          </div>
        </div>
        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-schedule">
              <Plus className="w-4 h-4 mr-2" />
              Create Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Pricing Schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  data-testid="input-effective-from"
                />
              </div>
              <div className="space-y-2">
                <Label>Floor SAR/Delivery</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={floorSar}
                  onChange={(e) => setFloorSar(e.target.value)}
                  placeholder="0.0000"
                  data-testid="input-floor-sar"
                />
              </div>
              <div className="space-y-2">
                <Label>Pricing Period</Label>
                <Input value="MONTHLY" disabled data-testid="input-pricing-period" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>Tiers</Label>
                  <Button variant="outline" size="sm" onClick={addTier} data-testid="button-add-tier">
                    <Plus className="w-3 h-3 mr-1" />
                    Add Tier
                  </Button>
                </div>
                {tiers.map((tier, idx) => (
                  <div key={idx} className="flex items-end gap-2 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-[80px]">
                      <Label className="text-xs">From</Label>
                      <Input
                        type="number"
                        value={tier.fromDeliveries}
                        onChange={(e) => updateTier(idx, "fromDeliveries", e.target.value)}
                        data-testid={`input-tier-from-${idx}`}
                      />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[80px]">
                      <Label className="text-xs">To</Label>
                      <Input
                        type="number"
                        value={tier.toDeliveries}
                        onChange={(e) => updateTier(idx, "toDeliveries", e.target.value)}
                        placeholder="Unlimited"
                        data-testid={`input-tier-to-${idx}`}
                      />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[80px]">
                      <Label className="text-xs">SAR/Delivery</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={tier.sarPerDelivery}
                        onChange={(e) => updateTier(idx, "sarPerDelivery", e.target.value)}
                        data-testid={`input-tier-sar-${idx}`}
                      />
                    </div>
                    {tiers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTier(idx)}
                        data-testid={`button-remove-tier-${idx}`}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                className="w-full"
                disabled={!floorSar || !effectiveFrom || createScheduleMutation.isPending}
                onClick={handleCreateSchedule}
                data-testid="button-submit-schedule"
              >
                {createScheduleMutation.isPending ? "Creating..." : "Create Schedule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No pricing schedules yet. Create one to define pricing tiers.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((schedule) => (
            <Card key={schedule.id} data-testid={`card-schedule-${schedule.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <p className="text-sm font-medium" data-testid={`text-schedule-date-${schedule.id}`}>
                    Effective: {schedule.effectiveFrom}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Floor: {Number(schedule.floorSarPerDelivery).toFixed(4)} SAR/delivery | {schedule.pricingPeriodType}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {schedule.tiers && schedule.tiers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="p-2 text-left text-xs font-medium text-muted-foreground">From</th>
                          <th className="p-2 text-left text-xs font-medium text-muted-foreground">To</th>
                          <th className="p-2 text-right text-xs font-medium text-muted-foreground">SAR/Delivery</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.tiers.map((tier) => (
                          <tr key={tier.id} className="border-b last:border-0" data-testid={`row-tier-${tier.id}`}>
                            <td className="p-2">{tier.fromDeliveries}</td>
                            <td className="p-2">{tier.toDeliveries ?? "Unlimited"}</td>
                            <td className="p-2 text-right font-medium">{Number(tier.sarPerDelivery).toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No tiers defined</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminVendorMastersPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [crn, setCrn] = useState("");
  const [iban, setIban] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [bankName, setBankName] = useState("");

  const [, pricingParams] = useRoute("/admin/vendor-masters/:id/pricing");

  const { data: vendorMasters, isLoading } = useQuery<VendorMaster[]>({
    queryKey: ["/api/vendor-masters"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      legalName: string;
      crn: string;
      iban: string | null;
      beneficiary: string | null;
      bankName: string | null;
    }) => {
      await apiRequest("POST", "/api/vendor-masters", data);
    },
    onSuccess: () => {
      toast({ title: "Vendor master created" });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-masters"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setLegalName("");
    setCrn("");
    setIban("");
    setBeneficiary("");
    setBankName("");
  }

  function handleSubmit() {
    createMutation.mutate({
      legalName,
      crn,
      iban: iban || null,
      beneficiary: beneficiary || null,
      bankName: bankName || null,
    });
  }

  if (pricingParams?.id) {
    return <VendorPricingPage vendorMasterId={pricingParams.id} />;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Vendor Masters</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage vendor masters</p>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const items = vendorMasters || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Vendor Masters</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage vendor masters</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-vendor-master">
              <Plus className="w-4 h-4 mr-2" />
              Create Vendor Master
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Vendor Master</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Legal Name</Label>
                <Input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Legal name"
                  data-testid="input-legal-name"
                />
              </div>
              <div className="space-y-2">
                <Label>CRN</Label>
                <Input
                  value={crn}
                  onChange={(e) => setCrn(e.target.value)}
                  placeholder="Commercial Registration Number"
                  data-testid="input-crn"
                />
              </div>
              <div className="space-y-2">
                <Label>IBAN</Label>
                <Input
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="IBAN"
                  data-testid="input-iban"
                />
              </div>
              <div className="space-y-2">
                <Label>Beneficiary</Label>
                <Input
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  placeholder="Beneficiary name"
                  data-testid="input-beneficiary"
                />
              </div>
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Bank name"
                  data-testid="input-bank-name"
                />
              </div>
              <Button
                className="w-full"
                disabled={!legalName || !crn || createMutation.isPending}
                onClick={handleSubmit}
                data-testid="button-submit-vendor-master"
              >
                {createMutation.isPending ? "Creating..." : "Create Vendor Master"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Store className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No vendor masters yet. Create one to get started.
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
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Legal Name</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">CRN</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">IBAN</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Beneficiary</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Bank Name</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((vm) => (
                    <tr
                      key={vm.id}
                      className="border-b last:border-0"
                      data-testid={`row-vendor-master-${vm.id}`}
                    >
                      <td className="p-3 font-medium" data-testid={`text-vendor-name-${vm.id}`}>
                        {vm.legalName}
                      </td>
                      <td className="p-3 text-muted-foreground" data-testid={`text-vendor-crn-${vm.id}`}>
                        {vm.crn}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs" data-testid={`text-vendor-iban-${vm.id}`}>
                        {vm.iban || "-"}
                      </td>
                      <td className="p-3 text-muted-foreground" data-testid={`text-vendor-beneficiary-${vm.id}`}>
                        {vm.beneficiary || "-"}
                      </td>
                      <td className="p-3 text-muted-foreground" data-testid={`text-vendor-bank-${vm.id}`}>
                        {vm.bankName || "-"}
                      </td>
                      <td className="p-3">
                        <Link href={`/admin/vendor-masters/${vm.id}/pricing`}>
                          <Button variant="outline" size="sm" data-testid={`link-pricing-${vm.id}`}>
                            Pricing
                          </Button>
                        </Link>
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

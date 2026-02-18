import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Percent } from "lucide-react";
import { useState } from "react";

type FeeRate = {
  id: string;
  label: string;
  minDays: number;
  maxDays: number;
  ratePer30d: string;
  createdAt: string;
};

export default function FeeRatesPage() {
  const { toast } = useToast();
  const [newRate, setNewRate] = useState({ label: "", minDays: "", maxDays: "", ratePer30d: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ label: "", minDays: "", maxDays: "", ratePer30d: "" });

  const { data: rates, isLoading } = useQuery<FeeRate[]>({
    queryKey: ["/api/fee-rates"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/fee-rates", {
        label: newRate.label,
        minDays: Number(newRate.minDays),
        maxDays: Number(newRate.maxDays),
        ratePer30d: newRate.ratePer30d,
      });
    },
    onSuccess: () => {
      toast({ title: "Rate Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/fee-rates"] });
      setNewRate({ label: "", minDays: "", maxDays: "", ratePer30d: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/fee-rates/${id}`, {
        label: editValues.label,
        minDays: Number(editValues.minDays),
        maxDays: Number(editValues.maxDays),
        ratePer30d: editValues.ratePer30d,
      });
    },
    onSuccess: () => {
      toast({ title: "Rate Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/fee-rates"] });
      setEditingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/fee-rates/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Rate Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/fee-rates"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const startEditing = (rate: FeeRate) => {
    setEditingId(rate.id);
    setEditValues({
      label: rate.label,
      minDays: String(rate.minDays),
      maxDays: String(rate.maxDays),
      ratePer30d: rate.ratePer30d,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold" data-testid="heading-fee-rates">Fee Rate Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure fee rates based on tenor (days to due date). Rates are applied per 30-day period.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add New Rate Bracket</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Label</Label>
              <Input
                value={newRate.label}
                onChange={(e) => setNewRate({ ...newRate, label: e.target.value })}
                placeholder="e.g. 0-15 days"
                data-testid="input-new-rate-label"
              />
            </div>
            <div>
              <Label className="text-xs">Min Days</Label>
              <Input
                type="number"
                value={newRate.minDays}
                onChange={(e) => setNewRate({ ...newRate, minDays: e.target.value })}
                placeholder="0"
                data-testid="input-new-rate-min"
              />
            </div>
            <div>
              <Label className="text-xs">Max Days</Label>
              <Input
                type="number"
                value={newRate.maxDays}
                onChange={(e) => setNewRate({ ...newRate, maxDays: e.target.value })}
                placeholder="15"
                data-testid="input-new-rate-max"
              />
            </div>
            <div>
              <Label className="text-xs">Rate / 30d (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={newRate.ratePer30d}
                onChange={(e) => setNewRate({ ...newRate, ratePer30d: e.target.value })}
                placeholder="1.5"
                data-testid="input-new-rate-value"
              />
            </div>
          </div>
          <Button
            className="mt-3"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !newRate.label || !newRate.minDays || !newRate.maxDays || !newRate.ratePer30d}
            data-testid="button-add-rate"
          >
            <Plus className="w-4 h-4 mr-2" />
            {createMutation.isPending ? "Adding..." : "Add Rate"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Rate Brackets</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!rates || rates.length === 0 ? (
            <div className="p-6 text-center">
              <Percent className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No fee rates configured yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Label</th>
                    <th className="p-3 text-center text-xs font-medium text-muted-foreground">Min Days</th>
                    <th className="p-3 text-center text-xs font-medium text-muted-foreground">Max Days</th>
                    <th className="p-3 text-center text-xs font-medium text-muted-foreground">Rate / 30d</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr key={rate.id} className="border-b last:border-0" data-testid={`row-rate-${rate.id}`}>
                      {editingId === rate.id ? (
                        <>
                          <td className="p-3">
                            <Input
                              value={editValues.label}
                              onChange={(e) => setEditValues({ ...editValues, label: e.target.value })}
                              className="h-8"
                              data-testid="input-edit-label"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <Input
                              type="number"
                              value={editValues.minDays}
                              onChange={(e) => setEditValues({ ...editValues, minDays: e.target.value })}
                              className="h-8 text-center"
                              data-testid="input-edit-min"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <Input
                              type="number"
                              value={editValues.maxDays}
                              onChange={(e) => setEditValues({ ...editValues, maxDays: e.target.value })}
                              className="h-8 text-center"
                              data-testid="input-edit-max"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <Input
                              type="number"
                              step="0.01"
                              value={editValues.ratePer30d}
                              onChange={(e) => setEditValues({ ...editValues, ratePer30d: e.target.value })}
                              className="h-8 text-center"
                              data-testid="input-edit-rate"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => updateMutation.mutate(rate.id)}
                                disabled={updateMutation.isPending}
                                data-testid="button-save-rate"
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                                data-testid="button-cancel-edit"
                              >
                                <span className="text-xs">X</span>
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 font-medium" data-testid={`text-rate-label-${rate.id}`}>{rate.label}</td>
                          <td className="p-3 text-center">{rate.minDays}</td>
                          <td className="p-3 text-center">{rate.maxDays}</td>
                          <td className="p-3 text-center">{(Number(rate.ratePer30d) * 100).toFixed(2)}%</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => startEditing(rate)}
                                data-testid={`button-edit-rate-${rate.id}`}
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteMutation.mutate(rate.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-rate-${rate.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

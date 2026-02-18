import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Store } from "lucide-react";
import { useState } from "react";
import type { Restaurant } from "@shared/schema";

function AddRestaurantForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/restaurants", {
        name,
        bankName: bankName || undefined,
        bankAccountNumber: bankAccountNumber || undefined,
        bankRoutingNumber: bankRoutingNumber || undefined,
        bankAccountName: bankAccountName || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Restaurant Created", description: `${name} has been added.` });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className="mt-3">
      <CardContent className="py-4 space-y-3">
        <div>
          <Label className="text-xs">Restaurant Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Burger Palace"
            data-testid="input-restaurant-name"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Bank Name</Label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" data-testid="input-bank-name" />
          </div>
          <div>
            <Label className="text-xs">Account Name</Label>
            <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Account holder" data-testid="input-bank-account-name" />
          </div>
          <div>
            <Label className="text-xs">Account Number</Label>
            <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="Account #" data-testid="input-bank-account-number" />
          </div>
          <div>
            <Label className="text-xs">Routing Number</Label>
            <Input value={bankRoutingNumber} onChange={(e) => setBankRoutingNumber(e.target.value)} placeholder="Routing #" data-testid="input-bank-routing-number" />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending} data-testid="button-save-restaurant">
            {mutation.isPending ? "Creating..." : "Create Restaurant"}
          </Button>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-restaurant">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminRestaurantsPage() {
  const [showAdd, setShowAdd] = useState(false);

  const { data: restaurants, isLoading } = useQuery<Restaurant[]>({
    queryKey: ["/api/restaurants"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" data-testid="heading-restaurants">Restaurants</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage restaurants on the platform</p>
        </div>
        {!showAdd && (
          <Button onClick={() => setShowAdd(true)} data-testid="button-add-restaurant">
            <Plus className="w-4 h-4 mr-2" />
            Add Restaurant
          </Button>
        )}
      </div>

      {showAdd && <AddRestaurantForm onClose={() => setShowAdd(false)} />}

      {(!restaurants || restaurants.length === 0) ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Store className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No restaurants yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {restaurants.map((r) => (
            <Card key={r.id} data-testid={`card-restaurant-${r.id}`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-sm" data-testid={`text-restaurant-name-${r.id}`}>{r.name}</p>
                    {r.bankName && (
                      <p className="text-xs text-muted-foreground">{r.bankName} - {r.bankAccountName}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Rate: {(Number(r.defaultRatePer30d) * 100).toFixed(1)}%</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

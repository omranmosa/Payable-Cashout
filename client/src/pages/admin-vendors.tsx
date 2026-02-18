import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2 } from "lucide-react";
import { useState } from "react";
import type { Restaurant } from "@shared/schema";

type VendorWithRestaurant = {
  id: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
};

function AddVendorForm({ restaurants, onClose }: { restaurants: Restaurant[]; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id || "");

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/vendors", { name, restaurantId });
    },
    onSuccess: () => {
      toast({ title: "Vendor Created", description: `${name} has been added.` });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
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
          <Label className="text-xs">Vendor Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sysco Foods"
            data-testid="input-vendor-name"
          />
        </div>
        <div>
          <Label className="text-xs">Restaurant *</Label>
          <Select value={restaurantId} onValueChange={setRestaurantId}>
            <SelectTrigger data-testid="select-vendor-restaurant">
              <SelectValue placeholder="Select restaurant" />
            </SelectTrigger>
            <SelectContent>
              {restaurants.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || !restaurantId || mutation.isPending} data-testid="button-save-vendor">
            {mutation.isPending ? "Creating..." : "Create Vendor"}
          </Button>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-vendor">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminVendorsPage() {
  const [showAdd, setShowAdd] = useState(false);

  const { data: vendorsData, isLoading: vendorsLoading } = useQuery<VendorWithRestaurant[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: restaurants } = useQuery<Restaurant[]>({
    queryKey: ["/api/restaurants"],
  });

  if (vendorsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" data-testid="heading-admin-vendors">Vendors</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage vendors across all restaurants</p>
        </div>
        {!showAdd && restaurants && restaurants.length > 0 && (
          <Button onClick={() => setShowAdd(true)} data-testid="button-add-vendor">
            <Plus className="w-4 h-4 mr-2" />
            Add Vendor
          </Button>
        )}
      </div>

      {showAdd && restaurants && (
        <AddVendorForm restaurants={restaurants} onClose={() => setShowAdd(false)} />
      )}

      {(!vendorsData || vendorsData.length === 0) ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No vendors yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {vendorsData.map((v) => (
            <Card key={v.id} data-testid={`card-vendor-${v.id}`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-sm" data-testid={`text-vendor-name-${v.id}`}>{v.name}</p>
                  </div>
                  <Badge variant="secondary">{v.restaurantName}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

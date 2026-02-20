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
import { Plus, Building2 } from "lucide-react";
import type { Counterparty } from "@shared/schema";

export default function AdminCounterpartiesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("RESTAURANT");
  const [notificationEmails, setNotificationEmails] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const { data: counterparties, isLoading } = useQuery<Counterparty[]>({
    queryKey: ["/api/counterparties"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      type: string;
      notificationEmails: string[] | null;
      webhookUrl: string | null;
    }) => {
      await apiRequest("POST", "/api/counterparties", data);
    },
    onSuccess: () => {
      toast({ title: "Counterparty created" });
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setName("");
    setType("RESTAURANT");
    setNotificationEmails("");
    setWebhookUrl("");
  }

  function handleSubmit() {
    const emails = notificationEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    createMutation.mutate({
      name,
      type,
      notificationEmails: emails.length > 0 ? emails : null,
      webhookUrl: webhookUrl || null,
    });
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Counterparties</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage counterparties</p>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const items = counterparties || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Counterparties</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage counterparties</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-counterparty">
              <Plus className="w-4 h-4 mr-2" />
              Create Counterparty
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Counterparty</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Counterparty name"
                  data-testid="input-counterparty-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger data-testid="select-counterparty-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESTAURANT">RESTAURANT</SelectItem>
                    <SelectItem value="AGGREGATOR">AGGREGATOR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notification Emails</Label>
                <Input
                  value={notificationEmails}
                  onChange={(e) => setNotificationEmails(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                  data-testid="input-notification-emails"
                />
              </div>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://..."
                  data-testid="input-webhook-url"
                />
              </div>
              <Button
                className="w-full"
                disabled={!name || createMutation.isPending}
                onClick={handleSubmit}
                data-testid="button-submit-counterparty"
              >
                {createMutation.isPending ? "Creating..." : "Create Counterparty"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No counterparties yet. Create one to get started.
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
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Notification Emails</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Webhook URL</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((cp) => (
                    <tr
                      key={cp.id}
                      className="border-b last:border-0"
                      data-testid={`row-counterparty-${cp.id}`}
                    >
                      <td className="p-3 font-medium" data-testid={`text-counterparty-name-${cp.id}`}>
                        {cp.name}
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-counterparty-type-${cp.id}`}>
                          {cp.type}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs" data-testid={`text-emails-${cp.id}`}>
                        {cp.notificationEmails?.join(", ") || "-"}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs" data-testid={`text-webhook-${cp.id}`}>
                        {cp.webhookUrl || "-"}
                      </td>
                      <td className="p-3 text-muted-foreground" data-testid={`text-created-${cp.id}`}>
                        {cp.createdAt ? new Date(cp.createdAt).toLocaleDateString() : "-"}
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

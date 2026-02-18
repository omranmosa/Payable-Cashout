import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary">
            <DollarSign className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">Payables Cashout</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Invoice financing platform
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <h2 className="text-base font-semibold text-center" data-testid="text-auth-title">
              {isRegister ? "Create Account" : "Sign In"}
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    required
                    data-testid="input-name"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                data-testid="button-submit-auth"
              >
                {isSubmitting
                  ? "Please wait..."
                  : isRegister
                    ? "Create Account"
                    : "Sign In"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:underline"
                onClick={() => setIsRegister(!isRegister)}
                data-testid="button-toggle-auth"
              >
                {isRegister
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Register"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

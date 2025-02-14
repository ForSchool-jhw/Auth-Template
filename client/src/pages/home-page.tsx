import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Plus, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AuthCode, insertAuthCodeSchema } from "@shared/schema";

const authCodeSchema = insertAuthCodeSchema;
type AuthCodeForm = z.infer<typeof authCodeSchema>;

interface TwoFactorSetupResponse {
  secret: string;
  otpauth_url: string;
  backup_codes: string[];
}

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [setup2FAOpen, setSetup2FAOpen] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const { toast } = useToast();

  const form = useForm<AuthCodeForm>({
    resolver: zodResolver(authCodeSchema),
    defaultValues: {
      serviceName: "",
      secretKey: "",
    },
  });

  const { data: authCodes = [] } = useQuery<AuthCode[]>({
    queryKey: ["/api/auth-codes"],
  });

  const createAuthCodeMutation = useMutation({
    mutationFn: async (data: AuthCodeForm) => {
      const res = await apiRequest("POST", "/api/auth-codes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth-codes"] });
      setIsOpen(false);
      form.reset();
      toast({
        title: "Auth Code Added",
        description: "Your authentication code has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Auth Code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setup2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/2fa/setup");
      return res.json() as Promise<TwoFactorSetupResponse>;
    },
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes);
      toast({
        title: "2FA Setup Complete",
        description: "Save your backup codes in a secure location. You won't be able to see them again!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome, {user?.username}!</h1>
            <p className="text-muted-foreground">Manage your authentication codes</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSetup2FAOpen(true)}
              disabled={user?.twoFactorEnabled}
            >
              <Shield className="mr-2 h-4 w-4" />
              {user?.twoFactorEnabled ? "2FA Enabled" : "Setup 2FA"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="flex items-center"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Grid for auth codes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {authCodes.length === 0 ? (
            <Card className="p-6 border-2 border-dashed border-muted">
              <div className="text-center text-muted-foreground">
                <p>No authentication codes yet</p>
                <p className="text-sm">Click the + button to add one</p>
              </div>
            </Card>
          ) : (
            authCodes.map((code) => (
              <Card key={code.id} className="p-6">
                <h3 className="font-semibold mb-2">{code.serviceName}</h3>
                <div className="font-mono text-2xl mb-4 text-primary">
                  {code.currentCode}
                </div>
                <p className="text-sm text-muted-foreground">
                  Added on {new Date(code.createdAt).toLocaleDateString()}
                </p>
              </Card>
            ))
          )}
        </div>

        {/* Add Auth Code Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-lg"
              size="icon"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Authentication Code</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createAuthCodeMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="serviceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Google, GitHub, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="secretKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secret Key</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your 2FA secret key"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createAuthCodeMutation.isPending}
                >
                  Add Code
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* 2FA Setup Dialog */}
        <Dialog open={setup2FAOpen} onOpenChange={setSetup2FAOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
            </DialogHeader>
            {backupCodes.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Save these backup codes in a secure location. You'll need them if you lose access to your authenticator app.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <code key={index} className="p-2 bg-muted rounded text-center">
                      {code}
                    </code>
                  ))}
                </div>
                <Button onClick={() => setSetup2FAOpen(false)} className="w-full">
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Two-factor authentication adds an extra layer of security to your account.
                </p>
                <Button
                  onClick={() => setup2FAMutation.mutate()}
                  disabled={setup2FAMutation.isPending}
                  className="w-full"
                >
                  Enable 2FA
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
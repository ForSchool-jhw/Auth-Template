import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Plus } from "lucide-react";
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

const authCodeSchema = z.object({
  serviceName: z.string().min(1, "Service name is required"),
  secretKey: z.string().min(16, "Secret key must be at least 16 characters"),
});

type AuthCodeForm = z.infer<typeof authCodeSchema>;

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<AuthCodeForm>({
    resolver: zodResolver(authCodeSchema),
    defaultValues: {
      serviceName: "",
      secretKey: "",
    },
  });

  function onSubmit(data: AuthCodeForm) {
    console.log(data); // We'll implement this later
    setIsOpen(false);
    form.reset();
  }

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome, {user?.username}!</h1>
            <p className="text-muted-foreground">Manage your authentication codes</p>
          </div>
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

        {/* Grid for auth codes - empty state */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-6 border-2 border-dashed border-muted">
            <div className="text-center text-muted-foreground">
              <p>No authentication codes yet</p>
              <p className="text-sm">Click the + button to add one</p>
            </div>
          </Card>
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <Button type="submit" className="w-full">
                  Add Code
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
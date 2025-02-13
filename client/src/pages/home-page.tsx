import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Plus, User } from "lucide-react";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();

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

        {/* Floating action button */}
        <Button
          className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-lg"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
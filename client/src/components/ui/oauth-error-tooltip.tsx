import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";

interface OAuthErrorTooltipProps {
  error: string;
}

export function OAuthErrorTooltip({ error }: OAuthErrorTooltipProps) {
  // Common GitHub OAuth errors and their solutions
  const getTroubleshootingSteps = (error: string) => {
    if (error.includes("redirect_uri_mismatch")) {
      return [
        "1. Check your GitHub OAuth callback URL",
        "2. It should be exactly: https://[your-repl-name].[your-username].repl.co/api/auth/github/callback",
        "3. Update it in your GitHub OAuth app settings"
      ];
    }
    if (error.includes("access_denied")) {
      return [
        "1. Make sure you approved all required permissions",
        "2. Try signing in again",
        "3. Check if you're signed into the correct GitHub account"
      ];
    }
    return [
      "1. Verify your GitHub account is active",
      "2. Clear your browser cookies and cache",
      "3. Try signing in again",
      "4. Contact support if the issue persists"
    ];
  };

  const steps = getTroubleshootingSteps(error);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center text-destructive">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>Authentication Error</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-4">
          <div className="space-y-2">
            <p className="font-semibold">Error: {error}</p>
            <p className="text-sm text-muted-foreground">Try these steps:</p>
            <ul className="text-sm list-none space-y-1">
              {steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

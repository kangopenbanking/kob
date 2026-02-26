import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface AuthRequiredAlertProps {
  feature?: string;
}

export function AuthRequiredAlert({ feature = "this feature" }: AuthRequiredAlertProps) {
  return (
    <Alert className="my-8">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Authentication Required</AlertTitle>
      <AlertDescription>
        You need to sign in to access {feature}.{" "}
        <Link to="/auth" className="underline font-medium text-primary hover:text-primary/80">
          Sign in here
        </Link>.
      </AlertDescription>
    </Alert>
  );
}

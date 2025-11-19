import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Copy, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ViewCredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentials: {
    loginId: string;
    temporaryPassword: string;
    expiresAt: string | Date;
  } | null;
  userName: string;
}

export function ViewCredentialsModal({
  open,
  onOpenChange,
  credentials,
  userName
}: ViewCredentialsModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`
    });
  };

  if (!credentials) return null;

  const expiryDate = typeof credentials.expiresAt === 'string' 
    ? new Date(credentials.expiresAt) 
    : credentials.expiresAt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Login Credentials</DialogTitle>
          <DialogDescription>
            Credentials for {userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Login ID</label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm">
                {credentials.loginId}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(credentials.loginId, "Login ID")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Temporary Password</label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm">
                {showPassword ? credentials.temporaryPassword : '••••••••••••'}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(credentials.temporaryPassword, "Password")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Valid until {format(expiryDate, 'PPp')}</span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
            <p className="font-medium">Important:</p>
            <p>These credentials are temporary. The user must change their password on first login.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

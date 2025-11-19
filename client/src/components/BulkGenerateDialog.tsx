import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface BulkGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  userCount: number;
  role: string;
}

export function BulkGenerateDialog({
  open,
  onOpenChange,
  onConfirm,
  userCount,
  role
}: BulkGenerateDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    generated: number;
    failed: number;
  } | null>(null);

  const handleConfirm = async () => {
    setIsGenerating(true);
    setResult(null);
    
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating credentials:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    if (!isGenerating) {
      setResult(null);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Generate Credentials for All {role}s?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isGenerating ? (
              <div className="space-y-4 py-4">
                <p>Generating credentials...</p>
                <Progress value={undefined} className="w-full" />
              </div>
            ) : result ? (
              <div className="space-y-3 py-4">
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{result.generated} credentials generated successfully</span>
                </div>
                {result.failed > 0 && (
                  <div className="flex items-center space-x-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">{result.failed} failed</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p>
                  This will generate new login credentials for <strong>{userCount}</strong> {role}{userCount !== 1 ? 's' : ''}.
                </p>
                <div className="flex items-start space-x-2 bg-amber-50 border border-amber-200 rounded-md p-3 mt-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Warning:</p>
                    <p>This will override any existing temporary passwords. Users will need to use the new credentials to log in.</p>
                  </div>
                </div>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isGenerating}>
            Cancel
          </AlertDialogCancel>
          {!result && (
            <AlertDialogAction onClick={handleConfirm} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate Credentials"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

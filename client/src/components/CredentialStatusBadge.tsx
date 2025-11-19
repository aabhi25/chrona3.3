import { Badge } from "@/components/ui/badge";

type CredentialStatus = 'active' | 'expires_soon' | 'expired' | 'not_generated';

interface CredentialStatusBadgeProps {
  status: CredentialStatus;
}

export function CredentialStatusBadge({ status }: CredentialStatusBadgeProps) {
  const variants: Record<CredentialStatus, { label: string; className: string }> = {
    active: {
      label: "Active",
      className: "bg-green-100 text-green-800 hover:bg-green-100"
    },
    expires_soon: {
      label: "Expires Soon",
      className: "bg-orange-100 text-orange-800 hover:bg-orange-100"
    },
    expired: {
      label: "Expired",
      className: "bg-red-100 text-red-800 hover:bg-red-100"
    },
    not_generated: {
      label: "No Login",
      className: "bg-gray-100 text-gray-800 hover:bg-gray-100"
    }
  };

  const variant = variants[status];

  return (
    <Badge variant="secondary" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

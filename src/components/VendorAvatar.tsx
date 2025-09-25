import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building } from "lucide-react";

interface VendorAvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function VendorAvatar({ name, logoUrl, size = "md", className = "" }: VendorAvatarProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-6 w-6"
  };

  const getInitials = (vendorName: string) => {
    return vendorName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {logoUrl ? (
        <AvatarImage 
          src={logoUrl} 
          alt={`${name} logo`}
          onError={(e) => {
            // Hide the image if it fails to load
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      <AvatarFallback className="bg-muted">
        {logoUrl ? (
          <Building className={iconSizes[size]} />
        ) : (
          <span className="text-xs font-medium">
            {getInitials(name)}
          </span>
        )}
      </AvatarFallback>
    </Avatar>
  );
}
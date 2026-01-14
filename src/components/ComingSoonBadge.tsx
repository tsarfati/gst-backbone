import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComingSoonBadgeProps {
  className?: string;
}

export function ComingSoonBadge({ className }: ComingSoonBadgeProps) {
  return (
    <div 
      className={cn(
        "absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-2 bg-muted/90 backdrop-blur-sm rounded-b-lg py-2 px-3",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground">Coming Soon</span>
    </div>
  );
}

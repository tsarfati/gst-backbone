import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComingSoonBadgeProps {
  className?: string;
}

export function ComingSoonBadge({ className }: ComingSoonBadgeProps) {
  return (
    <div 
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Clock className="h-6 w-6" />
        <span className="text-sm font-medium">Coming Soon</span>
      </div>
    </div>
  );
}

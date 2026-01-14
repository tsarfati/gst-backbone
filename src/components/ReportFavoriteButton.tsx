import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReportFavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  className?: string;
  size?: "sm" | "default" | "icon";
}

export function ReportFavoriteButton({
  isFavorite,
  onToggle,
  className,
  size = "icon",
}: ReportFavoriteButtonProps) {
  return (
    <Button
      variant="ghost"
      size={size}
      className={cn(
        "h-8 w-8 p-0 hover:bg-primary/10",
        isFavorite && "text-yellow-500",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Star
        className={cn(
          "h-4 w-4 transition-all",
          isFavorite && "fill-yellow-500"
        )}
      />
    </Button>
  );
}

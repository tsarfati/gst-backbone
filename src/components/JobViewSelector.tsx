import { Button } from "@/components/ui/button";
import { Grid3X3, List, Menu } from "lucide-react";

export type ViewType = "tiles" | "list" | "compact";

interface JobViewSelectorProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function JobViewSelector({ currentView, onViewChange }: JobViewSelectorProps) {
  return (
    <div className="flex items-center gap-1 border border-border rounded-md p-1">
      <Button
        variant={currentView === "tiles" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => onViewChange("tiles")}
        className="h-8 w-8 p-0"
      >
        <Grid3X3 className="h-4 w-4" />
      </Button>
      <Button
        variant={currentView === "list" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => onViewChange("list")}
        className="h-8 w-8 p-0"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant={currentView === "compact" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => onViewChange("compact")}
        className="h-8 w-8 p-0"
      >
        <Menu className="h-4 w-4" />
      </Button>
    </div>
  );
}
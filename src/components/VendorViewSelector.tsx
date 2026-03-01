import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Grid3X3, List, Menu, Settings } from "lucide-react";

export type VendorViewType = "tiles" | "list" | "compact";

interface VendorViewSelectorProps {
  currentView: VendorViewType;
  onViewChange: (view: VendorViewType) => void;
  onSetDefault: () => void;
  isDefault?: boolean;
}

const views = [
  { type: 'tiles' as const, icon: Grid3X3, label: 'Icon View' },
  { type: 'list' as const, icon: List, label: 'List View' },
  { type: 'compact' as const, icon: Menu, label: 'Compact View' },
];

export default function VendorViewSelector({ currentView, onViewChange, onSetDefault, isDefault = false }: VendorViewSelectorProps) {
  const currentViewConfig = views.find((view) => view.type === currentView);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          {currentViewConfig && <currentViewConfig.icon className="h-4 w-4" />}
          {currentViewConfig ? currentViewConfig.label : "Select View"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {views.map((view) => (
          <DropdownMenuItem
            key={view.type}
            onClick={() => onViewChange(view.type)}
            className={currentView === view.type ? "bg-accent" : ""}
          >
            <view.icon className="h-4 w-4 mr-2" />
            {view.label}
            {currentView === view.type && <Badge variant="secondary" className="ml-auto text-xs">Active</Badge>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSetDefault}>
          <Settings className="h-4 w-4 mr-2" />
          Set as Default
          {isDefault && <Badge variant="secondary" className="ml-auto text-xs">Default</Badge>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

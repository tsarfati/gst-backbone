import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { List, AlignJustify, Grid3X3, LayoutGrid, Settings } from "lucide-react";

export type UnifiedViewType = "list" | "compact" | "super-compact" | "icons";

interface UnifiedViewSelectorProps {
  currentView: UnifiedViewType;
  onViewChange: (view: UnifiedViewType) => void;
  onSetDefault: () => void;
  isDefault?: boolean;
  className?: string;
}

const views = [
  { type: 'list' as const, icon: List, label: 'List View' },
  { type: 'compact' as const, icon: AlignJustify, label: 'Compact View' },
  { type: 'super-compact' as const, icon: Grid3X3, label: 'Super Compact' },
  { type: 'icons' as const, icon: LayoutGrid, label: 'Icon View' }
];

export default function UnifiedViewSelector({ 
  currentView, 
  onViewChange, 
  onSetDefault, 
  isDefault = false,
  className = "" 
}: UnifiedViewSelectorProps) {
  const currentViewConfig = views.find(view => view.type === currentView);
  
  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            {currentViewConfig && <currentViewConfig.icon className="h-4 w-4" />}
            {currentViewConfig ? currentViewConfig.label : 'Select View'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {views.map((view) => (
            <DropdownMenuItem 
              key={view.type}
              onClick={() => onViewChange(view.type)}
              className={currentView === view.type ? 'bg-accent' : ''}
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
    </div>
  );
}
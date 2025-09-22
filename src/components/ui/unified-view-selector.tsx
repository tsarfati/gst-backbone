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
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {views.map((view) => (
        <Button
          key={view.type}
          variant={currentView === view.type ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewChange(view.type)}
          className="h-8"
        >
          <view.icon className="h-4 w-4" />
        </Button>
      ))}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onSetDefault}>
            Set as Default View
            {isDefault && <Badge variant="secondary" className="ml-2 text-xs">Current</Badge>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {views.map((view) => (
            <DropdownMenuItem 
              key={view.type}
              onClick={() => onViewChange(view.type)}
              className={currentView === view.type ? 'bg-accent' : ''}
            >
              <view.icon className="h-4 w-4 mr-2" />
              {view.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
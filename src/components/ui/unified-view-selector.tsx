import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { List, AlignJustify, Grid3X3, LayoutGrid, ChevronDown, Star } from "lucide-react";

export type UnifiedViewType = "list" | "compact" | "super-compact" | "icons";

interface UnifiedViewSelectorProps {
  currentView: UnifiedViewType;
  onViewChange: (view: UnifiedViewType) => void;
  onSetDefault: (view: UnifiedViewType) => void;
  defaultView?: UnifiedViewType;
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
  defaultView,
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
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
              <button
                type="button"
                className="ml-auto inline-flex items-center"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSetDefault(view.type);
                }}
                title={defaultView === view.type ? "Default view" : "Set as default view"}
              >
                <Star className={`h-4 w-4 ${defaultView === view.type ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

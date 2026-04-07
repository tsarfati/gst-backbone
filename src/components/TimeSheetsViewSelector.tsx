import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { List, LayoutGrid, Menu, Table, ChevronDown, Star } from "lucide-react";

export type TimeSheetsViewType = 'list' | 'compact' | 'super-compact' | 'table';

interface TimeSheetsViewSelectorProps {
  currentView: TimeSheetsViewType;
  onViewChange: (view: TimeSheetsViewType) => void;
  onSetDefault: (view: TimeSheetsViewType) => void;
  defaultView?: TimeSheetsViewType;
}

const views: Array<{ type: TimeSheetsViewType; label: string; icon: typeof List }> = [
  { type: 'list', label: 'List View', icon: List },
  { type: 'compact', label: 'Compact', icon: LayoutGrid },
  { type: 'super-compact', label: 'Super Compact', icon: Menu },
  { type: 'table', label: 'Table View', icon: Table },
];

export default function TimeSheetsViewSelector({ 
  currentView, 
  onViewChange, 
  onSetDefault,
  defaultView,
}: TimeSheetsViewSelectorProps) {
  const currentViewConfig = views.find(view => view.type === currentView) || views[0];
  const CurrentIcon = currentViewConfig.icon;

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-11 gap-2">
            <CurrentIcon className="h-4 w-4" />
            {currentViewConfig.label}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <DropdownMenuItem
                key={view.type}
                onClick={() => onViewChange(view.type)}
                className={currentView === view.type ? 'bg-accent' : ''}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{view.label}</span>
                <button
                  type="button"
                  className="ml-auto inline-flex items-center"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSetDefault(view.type);
                  }}
                  title={defaultView === view.type ? 'Default view' : 'Set as default view'}
                >
                  <Star className={`h-4 w-4 ${defaultView === view.type ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                </button>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

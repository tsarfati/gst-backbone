import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Rows3, ChevronDown, Star } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export type ViewType = 'grid' | 'list' | 'compact';

interface ViewSelectorProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onSetDefault: (view: ViewType) => void;
  defaultView?: ViewType;
}

function ViewSelector({ currentView, onViewChange, onSetDefault, defaultView }: ViewSelectorProps) {
  const views = [
    { type: 'grid' as const, icon: LayoutGrid, label: 'Tile View' },
    { type: 'list' as const, icon: List, label: 'List View' },
    { type: 'compact' as const, icon: Rows3, label: 'Compact View' }
  ];

  const activeView = views.find((view) => view.type === currentView) || views[0];
  const ActiveIcon = activeView.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <span className="text-xs text-muted-foreground">View By</span>
          <ActiveIcon className="h-4 w-4" />
          <span>{activeView.label}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {views.map((view) => (
          <DropdownMenuItem
            key={view.type}
            onClick={() => onViewChange(view.type)}
            className={currentView === view.type ? 'bg-accent' : ''}
          >
            <view.icon className="h-4 w-4 mr-2" />
            <span className="flex-1">{view.label}</span>
            <button
              type="button"
              className="ml-2 inline-flex h-6 w-6 items-center justify-center"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSetDefault(view.type);
              }}
              aria-label={`Set ${view.label} as default`}
            >
              <Star
                className={`h-4 w-4 ${defaultView === view.type ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
              />
            </button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ViewSelector;

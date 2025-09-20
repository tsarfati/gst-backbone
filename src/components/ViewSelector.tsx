import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Rows3, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export type ViewType = 'grid' | 'list' | 'compact';

interface ViewSelectorProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onSetDefault: () => void;
  isDefault?: boolean;
}

export default function ViewSelector({ currentView, onViewChange, onSetDefault, isDefault }: ViewSelectorProps) {
  const views = [
    { type: 'grid' as const, icon: LayoutGrid, label: 'Tile View' },
    { type: 'list' as const, icon: List, label: 'List View' },
    { type: 'compact' as const, icon: Rows3, label: 'Compact View' }
  ];

  return (
    <div className="flex items-center gap-2">
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
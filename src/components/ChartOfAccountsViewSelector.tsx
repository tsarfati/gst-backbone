import { Button } from '@/components/ui/button';
import { List, AlignJustify, Grid3X3, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export type ChartOfAccountsViewType = 'list' | 'compact' | 'super-compact';

interface ChartOfAccountsViewSelectorProps {
  currentView: ChartOfAccountsViewType;
  onViewChange: (view: ChartOfAccountsViewType) => void;
  onSetDefault: () => void;
  isDefault?: boolean;
}

export default function ChartOfAccountsViewSelector({ currentView, onViewChange, onSetDefault, isDefault }: ChartOfAccountsViewSelectorProps) {
  const views = [
    { type: 'list' as const, icon: List, label: 'List View' },
    { type: 'compact' as const, icon: AlignJustify, label: 'Compact View' },
    { type: 'super-compact' as const, icon: Grid3X3, label: 'Super Compact' }
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

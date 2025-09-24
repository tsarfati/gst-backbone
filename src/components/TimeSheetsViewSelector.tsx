import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { List, LayoutGrid, Menu, Table, Settings, Check } from "lucide-react";

export type TimeSheetsViewType = 'list' | 'compact' | 'super-compact' | 'table';

interface TimeSheetsViewSelectorProps {
  currentView: TimeSheetsViewType;
  onViewChange: (view: TimeSheetsViewType) => void;
  onSetDefault: () => void;
  isDefault: boolean;
}

export default function TimeSheetsViewSelector({ 
  currentView, 
  onViewChange, 
  onSetDefault,
  isDefault 
}: TimeSheetsViewSelectorProps) {
  const getViewIcon = (view: TimeSheetsViewType) => {
    switch (view) {
      case 'list': return <List className="h-4 w-4" />;
      case 'compact': return <LayoutGrid className="h-4 w-4" />;
      case 'super-compact': return <Menu className="h-4 w-4" />;
      case 'table': return <Table className="h-4 w-4" />;
      default: return <List className="h-4 w-4" />;
    }
  };

  const getViewLabel = (view: TimeSheetsViewType) => {
    switch (view) {
      case 'list': return 'List View';
      case 'compact': return 'Compact';
      case 'super-compact': return 'Super Compact';
      case 'table': return 'Table View';
      default: return 'List View';
    }
  };

  return (
    <div className="flex items-center gap-1 border border-border rounded-md p-1">
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
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={currentView === "super-compact" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => onViewChange("super-compact")}
        className="h-8 w-8 p-0"
      >
        <Menu className="h-4 w-4" />
      </Button>
      <Button
        variant={currentView === "table" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => onViewChange("table")}
        className="h-8 w-8 p-0"
      >
        <Table className="h-4 w-4" />
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onViewChange("list")}>
            <List className="mr-2 h-4 w-4" />
            List View
            {currentView === "list" && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewChange("compact")}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Compact
            {currentView === "compact" && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewChange("super-compact")}>
            <Menu className="mr-2 h-4 w-4" />
            Super Compact
            {currentView === "super-compact" && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewChange("table")}>
            <Table className="mr-2 h-4 w-4" />
            Table View
            {currentView === "table" && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSetDefault}>
            <Settings className="mr-2 h-4 w-4" />
            Set as Default {!isDefault && "(Current: " + getViewLabel(currentView) + ")"}
            {isDefault && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
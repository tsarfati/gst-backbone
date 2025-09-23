import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GripVertical, Eye, EyeOff, BarChart3, Clock, FileText, Users, TrendingUp, AlertTriangle, CheckCircle, Receipt, DollarSign, Bell, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface DashboardTile {
  id: string;
  label: string;
  description: string;
  category: 'core' | 'financial' | 'time' | 'project' | 'communication';
  enabled: boolean;
  order: number;
  icon: React.ComponentType<any>;
}

interface TilesByCategory {
  [key: string]: DashboardTile[];
}

interface SortableItemProps {
  tile: DashboardTile;
  onToggle: (id: string) => void;
}

function SortableItem({ tile, onToggle }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const IconComponent = tile.icon;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`${!tile.enabled ? 'opacity-60' : ''} cursor-pointer border transition-all hover:shadow-md`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${tile.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                <IconComponent className={`h-4 w-4 ${tile.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <span className={`font-medium ${!tile.enabled ? 'text-muted-foreground' : ''}`}>
                  {tile.label}
                </span>
                <p className="text-xs text-muted-foreground mt-1">{tile.description}</p>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggle(tile.id)}
            className="p-2 hover:bg-accent"
          >
            {tile.enabled ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface DashboardCustomizerProps {
  onSettingsChange: (settings: any) => void;
  currentSettings: any;
}

export default function DashboardCustomizer({ onSettingsChange, currentSettings }: DashboardCustomizerProps) {
  const [allTiles, setAllTiles] = useState<DashboardTile[]>([
    // Core Dashboard Sections
    { 
      id: 'stats', 
      label: 'Statistics Cards', 
      description: 'Key metrics and KPIs overview',
      category: 'core',
      enabled: currentSettings.show_stats || true, 
      order: 1,
      icon: BarChart3
    },
    { 
      id: 'notifications', 
      label: 'Notifications', 
      description: 'System alerts and updates',
      category: 'communication',
      enabled: currentSettings.show_notifications || true, 
      order: 2,
      icon: Bell
    },
    { 
      id: 'messages', 
      label: 'Messages', 
      description: 'Internal team communications',
      category: 'communication',
      enabled: currentSettings.show_messages || true, 
      order: 3,
      icon: MessageSquare
    },
    { 
      id: 'recent_activity', 
      label: 'Recent Activity', 
      description: 'Latest system events and changes',
      category: 'core',
      enabled: currentSettings.show_recent_activity || true, 
      order: 4,
      icon: Clock
    },
    { 
      id: 'active_jobs', 
      label: 'Active Jobs', 
      description: 'Current project status overview',
      category: 'project',
      enabled: currentSettings.show_active_jobs || true, 
      order: 5,
      icon: CheckCircle
    },
    
    // Financial Dashboard Sections
    { 
      id: 'bills_overview', 
      label: 'Bills Overview', 
      description: 'Pending and overdue bill status',
      category: 'financial',
      enabled: currentSettings.show_bills || false, 
      order: 6,
      icon: FileText
    },
    { 
      id: 'payment_status', 
      label: 'Payment Status', 
      description: 'Payment tracking and processing',
      category: 'financial',
      enabled: currentSettings.show_payment_status || false, 
      order: 7,
      icon: DollarSign
    },
    { 
      id: 'invoice_summary', 
      label: 'Invoice Summary', 
      description: 'Invoice generation and status',
      category: 'financial',
      enabled: currentSettings.show_invoice_summary || false, 
      order: 8,
      icon: Receipt
    },
    { 
      id: 'budget_tracking', 
      label: 'Budget Tracking', 
      description: 'Project budget vs actual costs',
      category: 'financial',
      enabled: currentSettings.show_budget_tracking || false, 
      order: 9,
      icon: TrendingUp
    },
    
    // Time Tracking Dashboard Sections
    { 
      id: 'punch_clock_status', 
      label: 'Punch Clock Status', 
      description: 'Employee time tracking overview',
      category: 'time',
      enabled: currentSettings.show_punch_clock_status || false, 
      order: 10,
      icon: Clock
    },
    { 
      id: 'timesheet_approval', 
      label: 'Timesheet Approvals', 
      description: 'Pending timesheet reviews',
      category: 'time',
      enabled: currentSettings.show_timesheet_approval || false, 
      order: 11,
      icon: CheckCircle
    },
    { 
      id: 'overtime_alerts', 
      label: 'Overtime Alerts', 
      description: 'Overtime tracking and notifications',
      category: 'time',
      enabled: currentSettings.show_overtime_alerts || false, 
      order: 12,
      icon: AlertTriangle
    },
    { 
      id: 'employee_attendance', 
      label: 'Employee Attendance', 
      description: 'Daily attendance summary',
      category: 'time',
      enabled: currentSettings.show_employee_attendance || false, 
      order: 13,
      icon: Users
    },
    
    // Project Management Sections
    { 
      id: 'project_progress', 
      label: 'Project Progress', 
      description: 'Overall project completion status',
      category: 'project',
      enabled: currentSettings.show_project_progress || false, 
      order: 14,
      icon: TrendingUp
    },
    { 
      id: 'task_deadlines', 
      label: 'Task Deadlines', 
      description: 'Upcoming and overdue tasks',
      category: 'project',
      enabled: currentSettings.show_task_deadlines || false, 
      order: 15,
      icon: AlertTriangle
    },
    { 
      id: 'resource_allocation', 
      label: 'Resource Allocation', 
      description: 'Team and equipment utilization',
      category: 'project',
      enabled: currentSettings.show_resource_allocation || false, 
      order: 16,
      icon: Users
    }
  ]);

  const { user } = useAuth();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group tiles by category
  const tilesByCategory: TilesByCategory = allTiles.reduce((acc, tile) => {
    if (!acc[tile.category]) acc[tile.category] = [];
    acc[tile.category].push(tile);
    return acc;
  }, {} as TilesByCategory);

  // Sort tiles within each category by order
  Object.keys(tilesByCategory).forEach(category => {
    tilesByCategory[category].sort((a, b) => a.order - b.order);
  });

  const categoryLabels = {
    core: 'Core Dashboard',
    financial: 'Financial Management',
    time: 'Time Tracking',
    project: 'Project Management',
    communication: 'Communication'
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setAllTiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        const newTiles = arrayMove(items, oldIndex, newIndex);
        // Update order numbers
        const updatedTiles = newTiles.map((tile, index) => ({ ...tile, order: index + 1 }));
        updateSettings(updatedTiles);
        return updatedTiles;
      });
    }
  }

  const toggleTile = (id: string) => {
    setAllTiles(prev => {
      const newTiles = prev.map(tile => 
        tile.id === id ? { ...tile, enabled: !tile.enabled } : tile
      );
      updateSettings(newTiles);
      return newTiles;
    });
  };

  const toggleCategory = (category: string, enabled: boolean) => {
    setAllTiles(prev => {
      const newTiles = prev.map(tile => 
        tile.category === category ? { ...tile, enabled } : tile
      );
      updateSettings(newTiles);
      return newTiles;
    });
  };

  const updateSettings = async (updatedTiles: DashboardTile[]) => {
    const settings = updatedTiles.reduce((acc, tile) => {
      // Convert tile IDs to settings properties
      const settingKey = `show_${tile.id}`;
      acc[settingKey] = tile.enabled;
      return acc;
    }, {} as any);

    onSettingsChange(settings);
  };

  const enabledCount = allTiles.filter(tile => tile.enabled).length;
  const totalCount = allTiles.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Dashboard Layout</h3>
          <p className="text-sm text-muted-foreground">
            Customize your dashboard by selecting sections from different areas of the application
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {enabledCount} of {totalCount} enabled
        </Badge>
      </div>

      <Tabs defaultValue="customize" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="customize">Customize Sections</TabsTrigger>
          <TabsTrigger value="reorder">Reorder Layout</TabsTrigger>
        </TabsList>

        <TabsContent value="customize" className="space-y-4">
          <div className="grid gap-4">
            {Object.entries(tilesByCategory).map(([category, tiles]) => (
              <Card key={category} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">
                      {categoryLabels[category as keyof typeof categoryLabels]}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {tiles.filter(t => t.enabled).length}/{tiles.length}
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleCategory(category, true)}
                          className="h-6 px-2 text-xs"
                        >
                          All
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleCategory(category, false)}
                          className="h-6 px-2 text-xs"
                        >
                          None
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tiles.map((tile) => (
                    <div key={tile.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tile.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                          <tile.icon className={`h-4 w-4 ${tile.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <p className={`font-medium text-sm ${!tile.enabled ? 'text-muted-foreground' : ''}`}>
                            {tile.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{tile.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={tile.enabled}
                        onCheckedChange={() => toggleTile(tile.id)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reorder" className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Drag and drop to reorder sections. Only enabled sections will appear on your dashboard.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={allTiles.filter(t => t.enabled)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {allTiles
                    .filter(tile => tile.enabled)
                    .sort((a, b) => a.order - b.order)
                    .map((tile) => (
                      <SortableItem
                        key={tile.id}
                        tile={tile}
                        onToggle={toggleTile}
                      />
                    ))}
                </div>
              </SortableContext>
            </DndContext>
            {allTiles.filter(t => t.enabled).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No sections are currently enabled.</p>
                <p className="text-sm">Go to the "Customize Sections" tab to enable dashboard sections.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
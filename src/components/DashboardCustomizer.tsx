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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface DashboardTile {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
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

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`${!tile.enabled ? 'opacity-60' : ''} cursor-pointer`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className={`font-medium ${!tile.enabled ? 'text-muted-foreground' : ''}`}>
              {tile.label}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggle(tile.id)}
            className="p-1"
          >
            {tile.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
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
  const [tiles, setTiles] = useState<DashboardTile[]>([
    { id: 'stats', label: 'Statistics Cards', enabled: currentSettings.show_stats, order: 1 },
    { id: 'notifications', label: 'Notifications', enabled: currentSettings.show_notifications, order: 2 },
    { id: 'messages', label: 'Messages', enabled: currentSettings.show_messages, order: 3 },
    { id: 'recent_activity', label: 'Recent Activity', enabled: currentSettings.show_recent_activity, order: 4 },
    { id: 'active_jobs', label: 'Active Jobs', enabled: currentSettings.show_active_jobs, order: 5 },
  ]);

  const { user } = useAuth();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setTiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        const newTiles = arrayMove(items, oldIndex, newIndex);
        updateSettings(newTiles);
        return newTiles;
      });
    }
  }

  const toggleTile = (id: string) => {
    setTiles(prev => {
      const newTiles = prev.map(tile => 
        tile.id === id ? { ...tile, enabled: !tile.enabled } : tile
      );
      updateSettings(newTiles);
      return newTiles;
    });
  };

  const updateSettings = async (updatedTiles: DashboardTile[]) => {
    const settings = {
      show_stats: updatedTiles.find(t => t.id === 'stats')?.enabled || false,
      show_notifications: updatedTiles.find(t => t.id === 'notifications')?.enabled || false,
      show_messages: updatedTiles.find(t => t.id === 'messages')?.enabled || false,
      show_recent_activity: updatedTiles.find(t => t.id === 'recent_activity')?.enabled || false,
      show_active_jobs: updatedTiles.find(t => t.id === 'active_jobs')?.enabled || false,
    };

    onSettingsChange(settings);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Drag tiles to reorder them and toggle visibility
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={tiles} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tiles.map((tile) => (
              <SortableItem
                key={tile.id}
                tile={tile}
                onToggle={toggleTile}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
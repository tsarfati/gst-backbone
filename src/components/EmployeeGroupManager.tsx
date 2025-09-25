import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ColorPicker from './ColorPicker';

interface EmployeeGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  company_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface EmployeeGroupManagerProps {
  onGroupChange?: () => void;
}

export default function EmployeeGroupManager({ onGroupChange }: EmployeeGroupManagerProps) {
  const [groups, setGroups] = useState<EmployeeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EmployeeGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6'
  });
  const { profile } = useAuth();
  const { toast } = useToast();

  const canManageGroups = profile?.role === 'admin' || profile?.role === 'controller';

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_groups')
        .select('*')
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error loading groups:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employee groups',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageGroups) return;

    setLoading(true);
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('employee_groups')
          .update({
            name: formData.name,
            description: formData.description,
            color: formData.color,
          })
          .eq('id', editingGroup.id);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Group updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('employee_groups')
          .insert({
            name: formData.name,
            description: formData.description,
            color: formData.color,
            company_id: profile?.current_company_id || profile?.user_id || '',
            created_by: profile?.user_id || '',
          });

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Group created successfully',
        });
      }

      setFormData({ name: '', description: '', color: '#3b82f6' });
      setEditingGroup(null);
      setShowCreateDialog(false);
      loadGroups();
      onGroupChange?.();
    } catch (error) {
      console.error('Error saving group:', error);
      toast({
        title: 'Error',
        description: 'Failed to save group',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (group: EmployeeGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      color: group.color,
    });
    setShowCreateDialog(true);
  };

  const handleDelete = async (groupId: string) => {
    if (!canManageGroups) return;
    
    try {
      const { error } = await supabase
        .from('employee_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Group deleted successfully',
      });
      
      loadGroups();
      onGroupChange?.();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete group',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', color: '#3b82f6' });
    setEditingGroup(null);
  };

  if (!canManageGroups) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Groups
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingGroup ? 'Edit Group' : 'Create New Group'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Group Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter group name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter group description"
                    rows={2}
                  />
                </div>

                <ColorPicker
                  label="Group Color"
                  value={formData.color}
                  onChange={(color) => setFormData(prev => ({ ...prev, color }))}
                />

                <div className="flex gap-3">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : (editingGroup ? 'Update Group' : 'Create Group')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No groups created yet. Create your first group to organize employees.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <div>
                    <h4 className="font-medium">{group.name}</h4>
                    {group.description && (
                      <p className="text-sm text-muted-foreground">{group.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEdit(group)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDelete(group.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
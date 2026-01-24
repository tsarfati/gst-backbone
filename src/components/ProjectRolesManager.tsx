import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, GripVertical, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';

interface ProjectRole {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function ProjectRolesManager() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '' });

  useEffect(() => {
    if (currentCompany?.id) {
      loadRoles();
    }
  }, [currentCompany?.id]);

  const DEFAULT_ROLES = [
    { name: 'Project Manager', description: 'Manages overall project execution and team coordination' },
    { name: 'Assistant Project Manager', description: 'Supports the project manager with daily operations' },
    { name: 'Superintendent', description: 'Oversees on-site construction activities' },
    { name: 'Employee', description: 'Company employee assigned to the project' },
    { name: 'Design Professional', description: 'Handles design and planning aspects' },
    { name: 'Architect', description: 'Provides architectural design and oversight' },
    { name: 'Engineer', description: 'Provides engineering expertise and oversight' },
    { name: 'Vendor', description: 'External vendor or supplier' },
    { name: 'Subcontractor', description: 'Contracted company for specialized work' },
  ];

  const loadRoles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_roles')
        .select('*')
        .eq('company_id', currentCompany?.id)
        .order('sort_order');

      if (error) throw error;
      
      // If no roles exist, create default roles
      if (!data || data.length === 0) {
        await createDefaultRoles();
        return; // createDefaultRoles will reload
      }
      
      setRoles(data || []);
    } catch (error) {
      console.error('Error loading project roles:', error);
      toast({
        title: "Error",
        description: "Failed to load project roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultRoles = async () => {
    if (!currentCompany?.id) return;
    
    try {
      const rolesToInsert = DEFAULT_ROLES.map((role, index) => ({
        company_id: currentCompany.id,
        name: role.name,
        description: role.description,
        sort_order: index + 1,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from('project_roles')
        .insert(rolesToInsert)
        .select();

      if (error) throw error;

      setRoles(data || []);
      toast({
        title: "Default roles created",
        description: "Standard project roles have been added to your company",
      });
    } catch (error) {
      console.error('Error creating default roles:', error);
      toast({
        title: "Error",
        description: "Failed to create default project roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addRole = async () => {
    if (!newRole.name.trim() || !currentCompany?.id) return;

    try {
      setSaving(true);
      const maxOrder = Math.max(0, ...roles.map(r => r.sort_order));
      
      const { data, error } = await supabase
        .from('project_roles')
        .insert({
          company_id: currentCompany.id,
          name: newRole.name.trim(),
          description: newRole.description.trim() || null,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Role exists",
            description: "A role with this name already exists",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      setRoles([...roles, data]);
      setNewRole({ name: '', description: '' });
      toast({
        title: "Role added",
        description: `"${data.name}" has been added`,
      });
    } catch (error) {
      console.error('Error adding role:', error);
      toast({
        title: "Error",
        description: "Failed to add role",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (roleId: string, updates: Partial<ProjectRole>) => {
    try {
      const { error } = await supabase
        .from('project_roles')
        .update(updates)
        .eq('id', roleId);

      if (error) throw error;

      setRoles(roles.map(r => r.id === roleId ? { ...r, ...updates } : r));
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const deleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete the "${roleName}" role? This will remove it from all project team members.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('project_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      setRoles(roles.filter(r => r.id !== roleId));
      toast({
        title: "Role deleted",
        description: `"${roleName}" has been removed`,
      });
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        title: "Error",
        description: "Failed to delete role",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading project roles...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Project Team Roles
        </CardTitle>
        <CardDescription>
          Define roles that can be assigned to project team members (e.g., Project Manager, Superintendent, Architect)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Role */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1 space-y-2">
            <Label htmlFor="role-name">Role Name</Label>
            <Input
              id="role-name"
              placeholder="e.g., Safety Officer"
              value={newRole.name}
              onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addRole()}
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="role-desc">Description (optional)</Label>
            <Input
              id="role-desc"
              placeholder="e.g., Ensures job site safety compliance"
              value={newRole.description}
              onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addRole()}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={addRole} disabled={saving || !newRole.name.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          </div>
        </div>

        {/* Existing Roles */}
        <div className="space-y-2">
          {roles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No project roles defined. Add roles above to get started.
            </div>
          ) : (
            roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{role.name}</span>
                    {!role.is_active && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-sm text-muted-foreground truncate">{role.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${role.id}`} className="text-xs text-muted-foreground">
                      Active
                    </Label>
                    <Switch
                      id={`active-${role.id}`}
                      checked={role.is_active}
                      onCheckedChange={(checked) => updateRole(role.id, { is_active: checked })}
                    />
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRole(role.id, role.name)}
                    className="text-muted-foreground hover:text-destructive"
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

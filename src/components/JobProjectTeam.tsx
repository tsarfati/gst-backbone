import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Trash2, Edit, Users, Mail, Phone, Building2, UserCheck, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';

interface ProjectRole {
  id: string;
  name: string;
}

interface DirectoryMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  project_role_id: string | null;
  project_role?: ProjectRole | null;
  is_primary_contact: boolean;
  is_project_team_member: boolean;
}

interface JobProjectTeamProps {
  jobId: string;
  refreshKey?: number;
}

export default function JobProjectTeam({ jobId, refreshKey }: JobProjectTeamProps) {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<DirectoryMember[]>([]);
  const [availableMembers, setAvailableMembers] = useState<DirectoryMember[]>([]);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<DirectoryMember | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentCompany?.id && jobId) {
      loadData();
    }
  }, [currentCompany?.id, jobId, refreshKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [allMembersRes, rolesRes] = await Promise.all([
        supabase
          .from('job_project_directory')
          .select(`
            id, name, email, phone, company_name, project_role_id, is_primary_contact, is_project_team_member,
            project_role:project_roles(id, name)
          `)
          .eq('job_id', jobId)
          .eq('is_active', true)
          .order('is_primary_contact', { ascending: false })
          .order('name'),
        supabase
          .from('project_roles')
          .select('id, name')
          .eq('company_id', currentCompany?.id)
          .eq('is_active', true)
          .order('sort_order'),
      ]);

      if (allMembersRes.error) throw allMembersRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const allMembers = allMembersRes.data || [];
      setTeamMembers(allMembers.filter(m => m.is_project_team_member));
      setAvailableMembers(allMembers.filter(m => !m.is_project_team_member));
      setRoles(rolesRes.data || []);
    } catch (error) {
      console.error('Error loading project team:', error);
      toast({
        title: "Error",
        description: "Failed to load project team",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingMember(null);
    setSelectedMemberId('');
    setSelectedRoleId('');
    setIsPrimaryContact(false);
    setDialogOpen(true);
  };

  const openEditDialog = (member: DirectoryMember) => {
    setEditingMember(member);
    setSelectedMemberId(member.id);
    setSelectedRoleId(member.project_role_id || '');
    setIsPrimaryContact(member.is_primary_contact);
    setDialogOpen(true);
  };

  const saveMember = async () => {
    if (!selectedMemberId && !editingMember) return;

    try {
      setSaving(true);

      const memberId = editingMember ? editingMember.id : selectedMemberId;

      const { error } = await supabase
        .from('job_project_directory')
        .update({
          is_project_team_member: true,
          project_role_id: selectedRoleId || null,
          is_primary_contact: isPrimaryContact,
        })
        .eq('id', memberId);

      if (error) throw error;

      toast({ title: editingMember ? "Team member updated" : "Added to project team" });
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving team member:', error);
      toast({
        title: "Error",
        description: "Failed to save team member",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove "${memberName}" from the project team?`)) return;

    try {
      const { error } = await supabase
        .from('job_project_directory')
        .update({ 
          is_project_team_member: false,
          project_role_id: null,
          is_primary_contact: false,
        })
        .eq('id', memberId);

      if (error) throw error;

      toast({ title: "Removed from project team" });
      loadData();
    } catch (error) {
      console.error('Error removing team member:', error);
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading project team...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Project Team
          </CardTitle>
          <CardDescription>
            Team members assigned to this project
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} size="sm" disabled={availableMembers.length === 0 && !editingMember}>
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMember ? 'Edit Team Member' : 'Add to Project Team'}
              </DialogTitle>
              <DialogDescription>
                {editingMember ? 'Update role and settings' : 'Select a person from the job directory'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!editingMember && (
                <div className="space-y-2">
                  <Label>Select Person *</Label>
                  {availableMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No one available. Add people to the Job Directory first.
                    </p>
                  ) : (
                    <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose from directory..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name} {member.company_name ? `(${member.company_name})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {editingMember && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{editingMember.name}</p>
                  {editingMember.company_name && (
                    <p className="text-sm text-muted-foreground">{editingMember.company_name}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Project Role</Label>
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="primary"
                  checked={isPrimaryContact}
                  onCheckedChange={setIsPrimaryContact}
                />
                <Label htmlFor="primary">Primary Contact</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={saveMember} 
                disabled={saving || (!editingMember && !selectedMemberId)}
              >
                {saving ? 'Saving...' : editingMember ? 'Update' : 'Add to Team'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {teamMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No team members assigned yet.</p>
            <p className="text-sm">
              {availableMembers.length > 0 
                ? 'Click "Add Member" to assign from the job directory.'
                : 'Add people to the Job Directory first, then assign them here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-4 p-3 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{member.name}</span>
                    {member.is_primary_contact && (
                      <Badge variant="default" className="text-xs gap-1">
                        <Star className="h-3 w-3" />
                        Primary
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {member.project_role?.name && (
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        {member.project_role.name}
                      </span>
                    )}
                    {member.company_name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {member.company_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  {member.email && (
                    <a href={`mailto:${member.email}`} className="p-2 hover:text-primary" title={member.email}>
                      <Mail className="h-4 w-4" />
                    </a>
                  )}
                  {member.phone && (
                    <a href={`tel:${member.phone}`} className="p-2 hover:text-primary" title={member.phone}>
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(member)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => removeMember(member.id, member.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

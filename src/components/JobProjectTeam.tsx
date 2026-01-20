import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, Edit, Users, Mail, Phone, Building2, UserCheck, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ProjectRole {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  project_role_id: string | null;
  project_role?: ProjectRole | null;
  linked_user_id: string | null;
  linked_vendor_id: string | null;
  notes: string | null;
  is_primary_contact: boolean;
  is_active: boolean;
}

interface JobProjectTeamProps {
  jobId: string;
}

const emptyMember = {
  name: '',
  email: '',
  phone: '',
  company_name: '',
  project_role_id: '',
  notes: '',
  is_primary_contact: false,
};

export default function JobProjectTeam({ jobId }: JobProjectTeamProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState(emptyMember);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentCompany?.id && jobId) {
      loadData();
    }
  }, [currentCompany?.id, jobId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load team members and roles in parallel
      const [membersRes, rolesRes] = await Promise.all([
        supabase
          .from('job_project_directory')
          .select(`
            *,
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

      if (membersRes.error) throw membersRes.error;
      if (rolesRes.error) throw rolesRes.error;

      setTeamMembers(membersRes.data || []);
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
    setFormData(emptyMember);
    setDialogOpen(true);
  };

  const openEditDialog = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      company_name: member.company_name || '',
      project_role_id: member.project_role_id || '',
      notes: member.notes || '',
      is_primary_contact: member.is_primary_contact,
    });
    setDialogOpen(true);
  };

  const saveMember = async () => {
    if (!formData.name.trim() || !currentCompany?.id || !user?.id) return;

    try {
      setSaving(true);

      const memberData = {
        job_id: jobId,
        company_id: currentCompany.id,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        company_name: formData.company_name.trim() || null,
        project_role_id: formData.project_role_id || null,
        notes: formData.notes.trim() || null,
        is_primary_contact: formData.is_primary_contact,
        created_by: user.id,
      };

      if (editingMember) {
        // Update existing
        const { error } = await supabase
          .from('job_project_directory')
          .update(memberData)
          .eq('id', editingMember.id);

        if (error) throw error;
        toast({ title: "Team member updated" });
      } else {
        // Create new
        const { error } = await supabase
          .from('job_project_directory')
          .insert(memberData);

        if (error) throw error;
        toast({ title: "Team member added" });
      }

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
        .update({ is_active: false })
        .eq('id', memberId);

      if (error) throw error;

      setTeamMembers(teamMembers.filter(m => m.id !== memberId));
      toast({ title: "Team member removed" });
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
            <Button onClick={openAddDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMember ? 'Edit Team Member' : 'Add Team Member'}
              </DialogTitle>
              <DialogDescription>
                {editingMember ? 'Update team member information' : 'Add a new member to the project team'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="John Smith"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Project Role</Label>
                <Select
                  value={formData.project_role_id}
                  onValueChange={(value) => setFormData({ ...formData, project_role_id: value })}
                >
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

              <div className="space-y-2">
                <Label htmlFor="company">Company/Firm</Label>
                <Input
                  id="company"
                  placeholder="ABC Architecture"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about this team member..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="primary"
                  checked={formData.is_primary_contact}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_primary_contact: checked })}
                />
                <Label htmlFor="primary">Primary Contact</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveMember} disabled={saving || !formData.name.trim()}>
                {saving ? 'Saving...' : editingMember ? 'Update' : 'Add Member'}
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
            <p className="text-sm">Click "Add Member" to build your project team.</p>
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
                    <a
                      href={`mailto:${member.email}`}
                      className="p-2 hover:text-primary transition-colors"
                      title={member.email}
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                  )}
                  {member.phone && (
                    <a
                      href={`tel:${member.phone}`}
                      className="p-2 hover:text-primary transition-colors"
                      title={member.phone}
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(member)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMember(member.id, member.name)}
                    className="text-muted-foreground hover:text-destructive"
                  >
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

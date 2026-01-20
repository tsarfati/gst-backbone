import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Trash2, Edit, FolderOpen, Mail, Phone, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface DirectoryMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  notes: string | null;
  is_active: boolean;
}

interface JobDirectoryProps {
  jobId: string;
  onDirectoryChange?: () => void;
}

const emptyMember = {
  name: '',
  email: '',
  phone: '',
  company_name: '',
  notes: '',
};

export default function JobDirectory({ jobId, onDirectoryChange }: JobDirectoryProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<DirectoryMember | null>(null);
  const [formData, setFormData] = useState(emptyMember);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentCompany?.id && jobId) {
      loadDirectory();
    }
  }, [currentCompany?.id, jobId]);

  const loadDirectory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_project_directory')
        .select('id, name, email, phone, company_name, notes, is_active')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading directory:', error);
      toast({
        title: "Error",
        description: "Failed to load job directory",
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

  const openEditDialog = (member: DirectoryMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      company_name: member.company_name || '',
      notes: member.notes || '',
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
        notes: formData.notes.trim() || null,
        created_by: user.id,
      };

      if (editingMember) {
        const { error } = await supabase
          .from('job_project_directory')
          .update(memberData)
          .eq('id', editingMember.id);

        if (error) throw error;
        toast({ title: "Directory member updated" });
      } else {
        const { error } = await supabase
          .from('job_project_directory')
          .insert(memberData);

        if (error) throw error;
        toast({ title: "Added to job directory" });
      }

      setDialogOpen(false);
      loadDirectory();
      onDirectoryChange?.();
    } catch (error) {
      console.error('Error saving directory member:', error);
      toast({
        title: "Error",
        description: "Failed to save directory member",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove "${memberName}" from the job directory? This will also remove them from the project team if assigned.`)) return;

    try {
      const { error } = await supabase
        .from('job_project_directory')
        .update({ is_active: false })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.filter(m => m.id !== memberId));
      toast({ title: "Removed from directory" });
      onDirectoryChange?.();
    } catch (error) {
      console.error('Error removing directory member:', error);
      toast({
        title: "Error",
        description: "Failed to remove directory member",
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
          <div className="text-center text-muted-foreground">Loading directory...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Job Directory
          </CardTitle>
          <CardDescription>
            People assigned to this job (add here before assigning to project team)
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Person
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMember ? 'Edit Directory Entry' : 'Add to Job Directory'}
              </DialogTitle>
              <DialogDescription>
                {editingMember ? 'Update contact information' : 'Add a person to this job\'s directory'}
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
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveMember} disabled={saving || !formData.name.trim()}>
                {saving ? 'Saving...' : editingMember ? 'Update' : 'Add to Directory'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No one assigned to this job yet.</p>
            <p className="text-sm">Add people to the directory before assigning them to the project team.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-2 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm truncate block">{member.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {member.company_name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {member.company_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  {member.email && (
                    <a href={`mailto:${member.email}`} className="p-1.5 hover:text-primary" title={member.email}>
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {member.phone && (
                    <a href={`tel:${member.phone}`} className="p-1.5 hover:text-primary" title={member.phone}>
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(member)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => removeMember(member.id, member.name)}>
                    <Trash2 className="h-3.5 w-3.5" />
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

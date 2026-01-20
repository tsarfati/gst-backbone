import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Trash2, Edit, FolderOpen, Mail, Phone, Building2, Check, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DirectoryMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  notes: string | null;
}

interface CompanyUser {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  type: 'user' | 'pin_employee';
}

interface JobDirectoryModalProps {
  jobId: string;
  onDirectoryChange?: () => void;
  trigger?: React.ReactNode;
}

const emptyMember = {
  name: '',
  email: '',
  phone: '',
  company_name: '',
  notes: '',
};

export default function JobDirectoryModal({ jobId, onDirectoryChange, trigger }: JobDirectoryModalProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<DirectoryMember | null>(null);
  const [formData, setFormData] = useState(emptyMember);
  const [saving, setSaving] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [namePopoverOpen, setNamePopoverOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState('');

  useEffect(() => {
    if (open && currentCompany?.id && jobId) {
      loadDirectory();
      loadCompanyUsers();
    }
  }, [open, currentCompany?.id, jobId]);

  const loadDirectory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_project_directory')
        .select('id, name, email, phone, company_name, notes')
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

  const loadCompanyUsers = async () => {
    if (!currentCompany?.id) return;
    
    try {
      // Fetch regular users with access to this company
      const { data: userAccess, error: userError } = await supabase
        .from('user_company_access')
        .select('user_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      if (userError) throw userError;
      
      const userIds = userAccess?.map(u => u.user_id) || [];
      
      let users: CompanyUser[] = [];
      
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, display_name, phone')
          .in('id', userIds);
        
        if (profileError) throw profileError;
        
        users = (profiles || []).map(p => ({
          id: p.id,
          display_name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.display_name || 'Unknown',
          email: null, // Email not stored in profiles table
          phone: p.phone,
          type: 'user' as const
        }));
      }
      
      // Fetch PIN employees
      const { data: pinEmployees, error: pinError } = await supabase
        .from('pin_employees')
        .select('id, first_name, last_name, email, phone')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      if (pinError) throw pinError;
      
      const pinUsers: CompanyUser[] = (pinEmployees || []).map(p => ({
        id: p.id,
        display_name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
        email: p.email,
        phone: p.phone,
        type: 'pin_employee' as const
      }));
      
      setCompanyUsers([...users, ...pinUsers].sort((a, b) => a.display_name.localeCompare(b.display_name)));
    } catch (error) {
      console.error('Error loading company users:', error);
    }
  };

  const selectCompanyUser = (companyUser: CompanyUser) => {
    setFormData({
      ...formData,
      name: companyUser.display_name,
      email: companyUser.email || '',
      phone: companyUser.phone || '',
    });
    setNamePopoverOpen(false);
    setNameSearch('');
  };

  const filteredCompanyUsers = companyUsers.filter(u => 
    u.display_name.toLowerCase().includes(nameSearch.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(nameSearch.toLowerCase()))
  );

  const openAddDialog = () => {
    setEditingMember(null);
    setFormData(emptyMember);
    setAddDialogOpen(true);
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
    setAddDialogOpen(true);
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

      setAddDialogOpen(false);
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
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
              <FolderOpen className="h-4 w-4" />
              Manage Directory
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Job Directory
            </DialogTitle>
            <DialogDescription>
              Add people to this job's directory before assigning them to the project team.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Loading...</div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No one in the directory yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2.5 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate block">{member.name}</span>
                      {member.company_name && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {member.company_name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {member.email && (
                        <a href={`mailto:${member.email}`} className="p-1.5 text-muted-foreground hover:text-primary" title={member.email}>
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {member.phone && (
                        <a href={`tel:${member.phone}`} className="p-1.5 text-muted-foreground hover:text-primary" title={member.phone}>
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
          </div>

          <DialogFooter>
            <Button onClick={openAddDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Person
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Member Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
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
              {editingMember ? (
                <Input
                  id="name"
                  placeholder="John Smith"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              ) : (
                <Popover open={namePopoverOpen} onOpenChange={setNamePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={namePopoverOpen}
                      className="w-full justify-start font-normal"
                    >
                      {formData.name || (
                        <span className="text-muted-foreground">Search or enter a name...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Search existing users..." 
                        value={nameSearch}
                        onValueChange={setNameSearch}
                      />
                      <CommandList>
                        {nameSearch && !filteredCompanyUsers.some(u => 
                          u.display_name.toLowerCase() === nameSearch.toLowerCase()
                        ) && (
                          <CommandItem
                            onSelect={() => {
                              setFormData({ ...formData, name: nameSearch });
                              setNamePopoverOpen(false);
                              setNameSearch('');
                            }}
                            className="flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add "{nameSearch}" as new contact
                          </CommandItem>
                        )}
                        {filteredCompanyUsers.length > 0 && (
                          <CommandGroup heading="Company Users">
                            {filteredCompanyUsers.map((companyUser) => (
                              <CommandItem
                                key={companyUser.id}
                                value={companyUser.id}
                                onSelect={() => selectCompanyUser(companyUser)}
                                className="flex items-center gap-2"
                              >
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div className="flex flex-col">
                                  <span>{companyUser.display_name}</span>
                                  {companyUser.email && (
                                    <span className="text-xs text-muted-foreground">{companyUser.email}</span>
                                  )}
                                </div>
                                {formData.name === companyUser.display_name && (
                                  <Check className="ml-auto h-4 w-4" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {!nameSearch && filteredCompanyUsers.length === 0 && (
                          <CommandEmpty>No users found. Type to add a new contact.</CommandEmpty>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
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
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveMember} disabled={saving || !formData.name.trim()}>
              {saving ? 'Saving...' : editingMember ? 'Update' : 'Add to Directory'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

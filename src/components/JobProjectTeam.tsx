import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Edit, Users, Mail, Phone, Building2, Star, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { useUserAvatars } from '@/hooks/useUserAvatar';
import UserAvatar from '@/components/UserAvatar';


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
  avatar_url: string | null;
  project_role_id: string | null;
  project_role?: ProjectRole | null;
  is_primary_contact: boolean;
  is_project_team_member: boolean;
  source?: 'directory' | 'pm' | 'assistant_pm' | 'employee';
}

interface JobProjectTeamProps {
  jobId: string;
}

export default function JobProjectTeam({ jobId }: JobProjectTeamProps) {
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
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (currentCompany?.id && jobId) {
      loadData();
    }
  }, [currentCompany?.id, jobId, refreshKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load directory members, roles, job details, and PIN employees in parallel
      const [allMembersRes, rolesRes, jobRes, assistantPMsRes] = await Promise.all([
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
        supabase
          .from('jobs')
          .select('project_manager_user_id')
          .eq('id', jobId)
          .single(),
        supabase
          .from('job_assistant_managers')
          .select('user_id')
          .eq('job_id', jobId),
      ]);

      if (allMembersRes.error) throw allMembersRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const allMembers = (allMembersRes.data || []).map(m => ({ ...m, avatar_url: null, source: 'directory' as const }));
      const directoryTeamMembers = allMembers.filter(m => m.is_project_team_member);
      const directoryAvailable = allMembers.filter(m => !m.is_project_team_member);
      
      setRoles(rolesRes.data || []);

      // Find PM and Assistant PM roles
      const pmRole = rolesRes.data?.find(r => r.name.toLowerCase().includes('project manager') && !r.name.toLowerCase().includes('assistant'));
      const assistantPMRole = rolesRes.data?.find(r => r.name.toLowerCase().includes('assistant') && r.name.toLowerCase().includes('project manager'));
      const employeeRole = rolesRes.data?.find(r => r.name.toLowerCase() === 'employee');

      // Build auto-populated team members
      const autoMembers: DirectoryMember[] = [];
      const pmUserId = jobRes.data?.project_manager_user_id;
      const assistantPMUserIds = (assistantPMsRes.data || []).map(a => a.user_id);
      const allManagerIds = [pmUserId, ...assistantPMUserIds].filter(Boolean) as string[];

      // Fetch PM and Assistant PM profile data
      if (allManagerIds.length > 0) {
        const { data: managerProfiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name, phone, avatar_url')
          .in('user_id', allManagerIds);

        // Fetch emails for managers
        const { data: emailData } = await supabase.functions.invoke('get-user-email', {
          body: { user_ids: allManagerIds }
        });
        
        const emailMap = new Map<string, string>();
        if (emailData?.users) {
          emailData.users.forEach((u: { id: string; email: string }) => {
            emailMap.set(u.id, u.email);
          });
        }

        // Add Project Manager
        if (pmUserId) {
          const pmProfile = managerProfiles?.find(p => p.user_id === pmUserId);
          if (pmProfile) {
            autoMembers.push({
              id: `pm-${pmUserId}`,
              name: [pmProfile.first_name, pmProfile.last_name].filter(Boolean).join(' ') || pmProfile.display_name || 'Unknown',
              email: emailMap.get(pmUserId) || null,
              phone: pmProfile.phone,
              company_name: currentCompany?.name || null,
              avatar_url: pmProfile.avatar_url,
              project_role_id: pmRole?.id || null,
              project_role: pmRole || { id: '', name: 'Project Manager' },
              is_primary_contact: false,
              is_project_team_member: true,
              source: 'pm'
            });
          }
        }

        // Add Assistant PMs
        for (const apmId of assistantPMUserIds) {
          const apmProfile = managerProfiles?.find(p => p.user_id === apmId);
          if (apmProfile) {
            autoMembers.push({
              id: `apm-${apmId}`,
              name: [apmProfile.first_name, apmProfile.last_name].filter(Boolean).join(' ') || apmProfile.display_name || 'Unknown',
              email: emailMap.get(apmId) || null,
              phone: apmProfile.phone,
              company_name: currentCompany?.name || null,
              avatar_url: apmProfile.avatar_url,
              project_role_id: assistantPMRole?.id || null,
              project_role: assistantPMRole || { id: '', name: 'Assistant Project Manager' },
              is_primary_contact: false,
              is_project_team_member: true,
              source: 'assistant_pm'
            });
          }
        }
      }

      // Load employees with timecard settings assigned to this job
      const { data: empSettings } = await supabase
        .from('employee_timecard_settings')
        .select('user_id, assigned_jobs')
        .eq('company_id', currentCompany?.id);

      const empIdsForJob = (empSettings || [])
        .filter(s => (s.assigned_jobs || []).includes(jobId))
        .map(s => s.user_id);

      if (empIdsForJob.length > 0) {
        const { data: empProfiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, phone, avatar_url')
          .in('user_id', empIdsForJob);

        for (const emp of (empProfiles || []) as any[]) {
          autoMembers.push({
            id: `emp-${emp.user_id}`,
            name: [emp.first_name, emp.last_name].filter(Boolean).join(' ') || 'Unknown',
            email: null,
            phone: emp.phone,
            company_name: currentCompany?.name || null,
            avatar_url: emp.avatar_url,
            project_role_id: employeeRole?.id || null,
            project_role: employeeRole || { id: '', name: 'Employee' },
            is_primary_contact: false,
            is_project_team_member: true,
            source: 'employee' as const
          });
        }
      }

      // Combine auto-populated and directory team members (remove duplicates by name)
      const existingNames = new Set(directoryTeamMembers.map(m => m.name.toLowerCase()));
      const uniqueAutoMembers = autoMembers.filter(m => !existingNames.has(m.name.toLowerCase()));
      
      setTeamMembers([...uniqueAutoMembers, ...directoryTeamMembers]);
      setAvailableMembers(directoryAvailable);
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

  const handleDirectoryChange = () => {
    setRefreshKey(prev => prev + 1);
  };

  const openAddDialog = () => {
    setEditingMember(null);
    setSelectedMemberId('');
    setSelectedRoleId('');
    setIsPrimaryContact(false);
    setDialogOpen(true);
  };

  const openEditDialog = (member: DirectoryMember) => {
    // Don't allow editing auto-populated members
    if (member.source && member.source !== 'directory') {
      toast({
        title: "Cannot edit",
        description: "This team member is auto-populated from job settings. Edit in Job Settings instead.",
        variant: "default",
      });
      return;
    }
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

  const removeMember = async (member: DirectoryMember) => {
    // Don't allow removing auto-populated members
    if (member.source && member.source !== 'directory') {
      toast({
        title: "Cannot remove",
        description: "This team member is auto-populated. Remove their job assignment in Job Settings instead.",
        variant: "default",
      });
      return;
    }

    if (!confirm(`Remove "${member.name}" from the project team?`)) return;

    try {
      const { error } = await supabase
        .from('job_project_directory')
        .update({ 
          is_project_team_member: false,
          project_role_id: null,
          is_primary_contact: false,
        })
        .eq('id', member.id);

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
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Extract user IDs from auto-populated members for avatar resolution
  const teamUserIds = useMemo(() => {
    return teamMembers
      .filter(m => m.source && m.source !== 'directory')
      .map(m => {
        const parts = m.id.split('-');
        return parts.slice(1).join('-'); // e.g. "pm-uuid" -> "uuid"
      })
      .filter(Boolean);
  }, [teamMembers]);

  const { avatarMap } = useUserAvatars(teamUserIds);

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'pm':
        return <Badge variant="secondary" className="text-xs">PM</Badge>;
      case 'assistant_pm':
        return <Badge variant="secondary" className="text-xs">Asst PM</Badge>;
      case 'employee':
        return <Badge variant="outline" className="text-xs">Employee</Badge>;
      default:
        return null;
    }
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
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Project Team
          </CardTitle>
          <CardDescription>
            Team members assigned to this project
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </CardHeader>
      <CardContent>
        {teamMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No team members assigned yet.</p>
            <p className="text-sm">
              {availableMembers.length > 0 
                ? 'Click "Add Member" to assign from the job directory.'
                : 'Use the Job Directory on the Edit Job page to add people first.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Group and render by type */}
            {(() => {
              const pmMembers = teamMembers.filter(m => m.source === 'pm');
              const apmMembers = teamMembers.filter(m => m.source === 'assistant_pm');
              const employeeMembers = teamMembers.filter(m => m.source === 'employee');
              const directoryMembers = teamMembers.filter(m => !m.source || m.source === 'directory');

              const renderMemberRow = (member: DirectoryMember) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 py-2 border-b last:border-b-0 hover:bg-muted/30 px-2 -mx-2 rounded transition-colors"
                >
                  {(() => {
                    // Resolve avatar: for auto members use the hook's map, for directory use avatar_url directly
                    let resolvedUrl = member.avatar_url;
                    if (member.source && member.source !== 'directory') {
                      const uid = member.id.split('-').slice(1).join('-');
                      if (uid && avatarMap[uid] !== undefined) {
                        resolvedUrl = avatarMap[uid];
                      }
                    }
                    return (
                      <UserAvatar
                        src={resolvedUrl}
                        name={member.name}
                        className="h-9 w-9 shrink-0"
                        fallbackClassName="bg-primary/10 text-primary text-sm"
                      />
                    );
                  })()}

                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{member.name}</span>
                      {member.is_primary_contact && (
                        <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" fill="currentColor" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate flex items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0 sm:hidden" />
                      {member.company_name || '-'}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {member.email ? (
                        <a href={`mailto:${member.email}`} className="hover:text-primary flex items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0 sm:hidden" />
                          {member.email}
                        </a>
                      ) : '-'}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {member.phone ? (
                        <a href={`tel:${member.phone}`} className="hover:text-primary flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0 sm:hidden" />
                          {member.phone}
                        </a>
                      ) : '-'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(!member.source || member.source === 'directory') && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(member)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => removeMember(member)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );

              const renderGroup = (title: string, members: DirectoryMember[], badgeVariant: 'default' | 'secondary' | 'outline' = 'secondary') => {
                if (members.length === 0) return null;
                return (
                  <div key={title}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={badgeVariant} className="text-xs">{title}</Badge>
                      <span className="text-xs text-muted-foreground">({members.length})</span>
                    </div>
                    {/* Header row - hidden on mobile */}
                    <div className="hidden sm:grid grid-cols-[40px_1fr] gap-3 mb-1 px-2 text-xs text-muted-foreground uppercase tracking-wide">
                      <div></div>
                      <div className="grid grid-cols-4 gap-4">
                        <div>Name</div>
                        <div>Company</div>
                        <div>Email</div>
                        <div>Phone</div>
                      </div>
                    </div>
                    <div className="divide-y">
                      {members.map(renderMemberRow)}
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {renderGroup('Project Managers', pmMembers, 'default')}
                  {renderGroup('Assistant Project Managers', apmMembers, 'secondary')}
                  {renderGroup('Employees', employeeMembers, 'outline')}
                  {renderGroup('Team Members', directoryMembers, 'secondary')}
                </>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
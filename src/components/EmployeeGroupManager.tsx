import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Plus, Edit, Trash2, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface EmployeeGroup {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
}

interface ManagedUser {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface EmployeeGroupManagerProps {
  onGroupChange?: () => void;
}

export default function EmployeeGroupManager({ onGroupChange }: EmployeeGroupManagerProps) {
  const { profile, user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [groups, setGroups] = useState<EmployeeGroup[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [membersByGroup, setMembersByGroup] = useState<Record<string, string[]>>({});
  const [creating, setCreating] = useState(false);
  const [searchByGroup, setSearchByGroup] = useState<Record<string, string>>({});
  const [openSelectorForGroup, setOpenSelectorForGroup] = useState<string | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const actorUserId = profile?.user_id || user?.id || null;

  const effectiveRole = profile?.role?.toLowerCase() || '';
  const canManageGroups = ['admin', 'controller', 'company_admin', 'owner', 'super_admin'].includes(effectiveRole);

  useEffect(() => {
    if (!currentCompany?.id) return;
    void Promise.all([loadGroups(), loadUsers()]);
  }, [currentCompany?.id]);

  useEffect(() => {
    if (!groups.length) {
      setMembersByGroup({});
      return;
    }
    void loadMembers(groups.map((g) => g.id));
  }, [groups]);

  const userLabel = (u: ManagedUser) =>
    u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || u.user_id;

  const loadGroups = async () => {
    if (!currentCompany?.id) return;
    const { data, error } = await supabase
      .from('employee_groups')
      .select('id, name, description, created_by')
      .eq('company_id', currentCompany.id)
      .order('name');

    if (error) {
      console.error('Error loading groups:', error);
      toast({ title: 'Error', description: 'Failed to load groups', variant: 'destructive' });
      return;
    }
    setGroups((data as EmployeeGroup[]) || []);
  };

  const loadUsers = async () => {
    if (!currentCompany?.id) return;

    const { data: companyUsers, error: companyUsersError } = await supabase
      .from('user_company_access')
      .select('user_id')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true);

    if (companyUsersError) {
      console.error('Error loading company users:', companyUsersError);
      toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
      return;
    }

    const userIds = (companyUsers || []).map((u: any) => u.user_id);
    if (!userIds.length) {
      setUsers([]);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, display_name, avatar_url')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('Error loading profiles:', profilesError);
      toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
      return;
    }

    const { data: authData, error: authError } = await supabase.rpc('get_users_emails' as any, { user_ids: userIds });
    if (authError) {
      console.warn('Could not load user emails:', authError);
    }

    const emailMap = new Map<string, string>();
    ((authData as any[]) || []).forEach((row: any) => emailMap.set(row.user_id, row.email));

    const mapped: ManagedUser[] = (profilesData || []).map((p: any) => ({
      user_id: p.user_id,
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      display_name: p.display_name || null,
      email: emailMap.get(p.user_id) || null,
      avatar_url: p.avatar_url || null,
    }));

    mapped.sort((a, b) => userLabel(a).localeCompare(userLabel(b)));
    setUsers(mapped);
  };

  const loadMembers = async (groupIds: string[]) => {
    if (!groupIds.length) return;

    const { data: junctionRows } = await supabase
      .from('employee_group_members')
      .select('group_id, user_id')
      .in('group_id', groupIds);

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('user_id, group_id')
      .in('group_id', groupIds as any);

    const merged = [
      ...((junctionRows || []).map((r: any) => ({ group_id: r.group_id, user_id: r.user_id }))),
      ...((profileRows || [])
        .filter((r: any) => !!r.group_id)
        .map((r: any) => ({ group_id: r.group_id, user_id: r.user_id }))),
    ];

    const unique = Array.from(new Map(merged.map((m) => [`${m.group_id}:${m.user_id}`, m])).values());
    const next: Record<string, string[]> = {};
    groupIds.forEach((id) => {
      next[id] = unique.filter((m) => m.group_id === id).map((m) => m.user_id);
    });
    setMembersByGroup(next);
  };

  const handleCreateGroup = async () => {
    if (!currentCompany?.id) return;
    if (!actorUserId) {
      toast({ title: 'Error', description: 'Missing current user context.', variant: 'destructive' });
      return;
    }
    const name = window.prompt('Enter group name');
    const trimmed = name?.trim();
    if (!trimmed) return;
    const descriptionInput = window.prompt('Enter group description (optional)');
    const description = descriptionInput?.trim() || null;

    setCreating(true);
    const { error } = await supabase.from('employee_groups').insert({
      company_id: currentCompany.id,
      name: trimmed,
      description,
      created_by: actorUserId,
    } as any);
    setCreating(false);

    if (error) {
      console.error('Error creating group:', error);
      toast({ title: 'Error', description: error.message || 'Failed to create group', variant: 'destructive' });
      return;
    }

    toast({ title: 'Group created', description: `${trimmed} created.` });
    await loadGroups();
    onGroupChange?.();
  };

  const handleRenameGroup = async (group: EmployeeGroup) => {
    const name = window.prompt('Rename group', group.name);
    const trimmed = name?.trim();
    if (!trimmed || trimmed === group.name) return;
    const descriptionInput = window.prompt('Update description (optional)', group.description || '');
    const description = descriptionInput?.trim() || null;

    setRenamingGroupId(group.id);
    const { error } = await supabase.from('employee_groups').update({ name: trimmed, description }).eq('id', group.id);
    setRenamingGroupId(null);

    if (error) {
      console.error('Error renaming group:', error);
      toast({ title: 'Error', description: error.message || 'Failed to rename group', variant: 'destructive' });
      return;
    }

    toast({ title: 'Group renamed', description: `${group.name} renamed to ${trimmed}.` });
    await loadGroups();
    onGroupChange?.();
  };

  const handleDeleteGroup = async (group: EmployeeGroup) => {
    const confirmed = window.confirm(`Delete group "${group.name}"?`);
    if (!confirmed) return;

    setDeletingGroupId(group.id);
    await supabase.from('employee_group_members').delete().eq('group_id', group.id);
    await supabase.from('profiles').update({ group_id: null } as any).eq('group_id', group.id);
    const { error } = await supabase.from('employee_groups').delete().eq('id', group.id);
    setDeletingGroupId(null);

    if (error) {
      console.error('Error deleting group:', error);
      toast({ title: 'Error', description: error.message || 'Failed to delete group', variant: 'destructive' });
      return;
    }

    toast({ title: 'Group deleted', description: `${group.name} deleted.` });
    await loadGroups();
    onGroupChange?.();
  };

  const toggleMember = async (groupId: string, userId: string, checked: boolean) => {
    if (!currentCompany?.id) return;
    if (!actorUserId) {
      toast({ title: 'Error', description: 'Missing current user context.', variant: 'destructive' });
      return;
    }

    const current = membersByGroup[groupId] || [];
    const next = checked ? Array.from(new Set([...current, userId])) : current.filter((id) => id !== userId);
    setMembersByGroup((prev) => ({ ...prev, [groupId]: next }));

    if (checked) {
      const { data: existing, error: existingError } = await supabase
        .from('employee_group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingError) {
        console.error('Error checking existing group membership:', existingError);
        toast({ title: 'Error', description: 'Failed to add user to group', variant: 'destructive' });
        return;
      }

      let error: any = null;
      if (!existing) {
        const insertRes = await supabase.from('employee_group_members').insert({
          group_id: groupId,
          user_id: userId,
          created_by: actorUserId,
        } as any);
        error = insertRes.error;
      }

      if (error) {
        console.error('Error adding member:', error);
        toast({ title: 'Error', description: 'Failed to add user to group', variant: 'destructive' });
      }
    } else {
      const { error } = await supabase
        .from('employee_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);
      if (error) {
        console.error('Error removing member:', error);
        toast({ title: 'Error', description: 'Failed to remove user from group', variant: 'destructive' });
      }
    }

    // Keep legacy single-group pointer coherent where possible.
    const fallbackGroup = groups.find((g) => g.id !== groupId)?.id || null;
    if (checked) {
      await supabase.from('profiles').update({ group_id: groupId } as any).eq('user_id', userId);
    } else {
      const { data: profileRow } = await supabase.from('profiles').select('group_id').eq('user_id', userId).maybeSingle();
      if (profileRow?.group_id === groupId) {
        await supabase.from('profiles').update({ group_id: fallbackGroup } as any).eq('user_id', userId);
      }
    }
    onGroupChange?.();
  };

  const filteredUsersByGroup = useMemo(() => {
    const output: Record<string, ManagedUser[]> = {};
    groups.forEach((group) => {
      const q = (searchByGroup[group.id] || '').trim().toLowerCase();
      output[group.id] = !q
        ? users
        : users.filter((u) => {
            const label = userLabel(u).toLowerCase();
            return label.includes(q) || (u.email || '').toLowerCase().includes(q);
          });
    });
    return output;
  }, [groups, users, searchByGroup]);

  if (!canManageGroups) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Groups
          </CardTitle>
          <Button onClick={() => void handleCreateGroup()} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            {creating ? 'Creating...' : 'Add Group'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups yet. Create one to organize users.</p>
          ) : (
            groups.map((group) => {
              const members = membersByGroup[group.id] || [];
              const selectorOpen = openSelectorForGroup === group.id;
              return (
                <div key={group.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                      <div className="font-medium">{group.name}</div>
                      {group.description && (
                        <div className="text-xs text-muted-foreground truncate">{group.description}</div>
                      )}
                      <div className="text-sm text-muted-foreground">{members.length} member{members.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Popover open={selectorOpen} onOpenChange={(open) => setOpenSelectorForGroup(open ? group.id : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            Manage Users
                            <ChevronDown className="h-4 w-4 ml-1" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="end">
                          <div className="border-b p-2">
                            <Input
                              placeholder="Search users..."
                              value={searchByGroup[group.id] || ''}
                              onChange={(e) =>
                                setSearchByGroup((prev) => ({
                                  ...prev,
                                  [group.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <ScrollArea className="h-72">
                            <div className="p-2 space-y-1">
                              {filteredUsersByGroup[group.id].map((user) => {
                                const checked = members.includes(user.user_id);
                                return (
                                  <label
                                    key={`${group.id}-${user.user_id}`}
                                    className="flex cursor-pointer items-center justify-between rounded px-2 py-1 hover:bg-muted gap-3"
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      <div className="h-7 w-7 shrink-0 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                                        {user.avatar_url ? (
                                          <img
                                            src={user.avatar_url}
                                            alt={userLabel(user)}
                                            className="h-full w-full object-cover"
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).style.display = 'none';
                                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                            }}
                                          />
                                        ) : null}
                                        <span className={`text-[10px] font-semibold text-primary ${user.avatar_url ? 'hidden' : ''}`}>
                                          {userInitials(user)}
                                        </span>
                                      </div>
                                      <div className="truncate text-sm">{userLabel(user)}</div>
                                      {user.email && <div className="truncate text-xs text-muted-foreground">{user.email}</div>}
                                    </div>
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(v) => void toggleMember(group.id, user.user_id, !!v)}
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                      <Button variant="outline" size="sm" onClick={() => void handleRenameGroup(group)} disabled={renamingGroupId === group.id}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => void handleDeleteGroup(group)} disabled={deletingGroupId === group.id}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {members.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {members.slice(0, 6).map((id) => {
                        const user = users.find((u) => u.user_id === id);
                        return (
                          <Badge key={`${group.id}-badge-${id}`} variant="secondary" className="text-xs">
                            {user ? userLabel(user) : id}
                          </Badge>
                        );
                      })}
                      {members.length > 6 && <Badge variant="outline" className="text-xs">+{members.length - 6} more</Badge>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
  const userInitials = (u: ManagedUser) => {
    const first = (u.first_name || '').trim();
    const last = (u.last_name || '').trim();
    const d = (u.display_name || '').trim();
    const initials = `${first[0] || d[0] || ''}${last[0] || ''}`.toUpperCase();
    return initials || 'U';
  };

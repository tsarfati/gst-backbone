import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, Send, Users, User, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserAvatars } from '@/hooks/useUserAvatar';
import UserAvatar from '@/components/UserAvatar';
import { createMentionNotifications } from '@/utils/mentions';
import MentionTextarea from '@/components/MentionTextarea';

const CURRENT_USER_ID = 'fa67f9ba-67fc-4708-9526-7bfef906dae3';
const CURRENT_COMPANY_ID = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560';

interface ComposeMessageDialogProps {
  children: React.ReactNode;
  onMessageSent?: () => void;
}

interface UserOption {
  id: string;
  user_id: string;
  name: string;
  role: string;
  department?: string;
  avatar_url?: string | null;
}

const mapDirectoryUsers = (
  rows: Array<{
    user_id: string;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    role?: string | null;
    avatar_url?: string | null;
  }>,
  fallbackRole: string,
  currentUserId: string
): UserOption[] =>
  rows
    .filter((row) => row.user_id && row.user_id !== currentUserId)
    .map((row) => ({
      id: row.user_id,
      user_id: row.user_id,
      name:
        row.display_name ||
        [row.first_name, row.last_name].filter(Boolean).join(' ') ||
        'Unknown User',
      role: String(row.role || fallbackRole),
      avatar_url: row.avatar_url || null,
    }));

export default function ComposeMessageDialog({ children, onMessageSent }: ComposeMessageDialogProps) {
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<UserOption[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [priority, setPriority] = useState('normal');
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);

  const userId = user?.id || CURRENT_USER_ID;
  const isDesignProfessional = String(profile?.role || '').toLowerCase() === 'design_professional';
  const companyId = (isDesignProfessional ? profile?.current_company_id : currentCompany?.id) || currentCompany?.id || CURRENT_COMPANY_ID;
  const actorName =
    (user as any)?.user_metadata?.full_name ||
    (user as any)?.user_metadata?.name ||
    (user as any)?.email ||
    'A teammate';
  const availableUserIds = availableUsers.map((u) => u.user_id);
  const { avatarMap } = useUserAvatars(availableUserIds);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open, companyId, userId]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      if (!isDesignProfessional) {
        const { data, error } = await supabase
          .rpc('get_company_directory', { p_company_id: companyId });

        if (error) throw error;

        const companyUsers = mapDirectoryUsers((data || []) as any[], 'employee', userId)
          .sort((a, b) => a.name.localeCompare(b.name));

        setAvailableUsers(companyUsers);
        return;
      }

      let ownCompanyUsers: UserOption[] = [];
      const { data: ownCompanyDirectory, error: ownCompanyError } = await supabase
        .rpc('get_company_directory', { p_company_id: companyId });

      if (!ownCompanyError) {
        ownCompanyUsers = mapDirectoryUsers((ownCompanyDirectory || []) as any[], 'design_professional', userId);
      } else {
        console.warn('Design professional company directory lookup failed, falling back to direct company access lookup.', ownCompanyError);
        const { data: ownCompanyAccessRows, error: ownCompanyAccessError } = await supabase
          .from('user_company_access')
          .select('user_id, role')
          .eq('company_id', companyId)
          .eq('is_active', true);

        if (!ownCompanyAccessError) {
          const ownCompanyUserIds = Array.from(new Set((ownCompanyAccessRows || []).map((row: any) => row.user_id).filter(Boolean)));
          if (ownCompanyUserIds.length > 0) {
            const { data: ownCompanyProfiles, error: ownCompanyProfilesError } = await supabase
              .from('profiles')
              .select('user_id, first_name, last_name, display_name, avatar_url, role')
              .in('user_id', ownCompanyUserIds);

            if (!ownCompanyProfilesError) {
              ownCompanyUsers = mapDirectoryUsers((ownCompanyProfiles || []) as any[], 'design_professional', userId);
            } else {
              console.warn('Design professional profile fallback lookup failed.', ownCompanyProfilesError);
            }
          }
        } else {
          console.warn('Design professional company access fallback lookup failed.', ownCompanyAccessError);
        }
      }

      let sharedJobIds: string[] = [];
      const { data: sharedJobAccessRows, error: sharedJobAccessError } = await supabase
        .from('user_job_access')
        .select('job_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!sharedJobAccessError) {
        sharedJobIds = Array.from(new Set((sharedJobAccessRows || []).map((row: any) => row.job_id).filter(Boolean)));
      } else {
        console.warn('Shared job access lookup failed for compose recipients.', sharedJobAccessError);
      }

      let sharedJobUsers: UserOption[] = [];

      if (sharedJobIds.length > 0) {
        const { data: sharedDirectoryRows, error: sharedDirectoryError } = await supabase
          .from('job_project_directory')
          .select('linked_user_id, name')
          .in('job_id', sharedJobIds)
          .eq('is_project_team_member', true)
          .eq('is_active', true)
          .not('linked_user_id', 'is', null);

        if (!sharedDirectoryError) {
          const sharedUserIds = Array.from(
            new Set((sharedDirectoryRows || []).map((row: any) => row.linked_user_id).filter((id: any) => !!id && id !== userId))
          );

          if (sharedUserIds.length > 0) {
            const { data: sharedProfiles, error: sharedProfilesError } = await supabase
              .from('profiles')
              .select('user_id, first_name, last_name, display_name, avatar_url, role')
              .in('user_id', sharedUserIds);

            if (!sharedProfilesError) {
              const profileMap = new Map((sharedProfiles || []).map((row: any) => [row.user_id, row]));
              sharedJobUsers = sharedUserIds.map((sharedUserId) => {
                const profileRow: any = profileMap.get(sharedUserId);
                const directoryRow = (sharedDirectoryRows || []).find((row: any) => row.linked_user_id === sharedUserId);
                return {
                  id: sharedUserId,
                  user_id: sharedUserId,
                  name:
                    profileRow?.display_name ||
                    [profileRow?.first_name, profileRow?.last_name].filter(Boolean).join(' ') ||
                    directoryRow?.name ||
                    'Unknown User',
                  role: String(profileRow?.role || 'project_member'),
                  avatar_url: profileRow?.avatar_url || null,
                };
              });
            } else {
              console.warn('Shared job profile lookup failed for compose recipients.', sharedProfilesError);
            }
          }
        } else {
          console.warn('Shared project directory lookup failed for compose recipients.', sharedDirectoryError);
        }
      }

      const mergedUsers = Array.from(
        new Map(
          [...ownCompanyUsers, ...sharedJobUsers]
            .filter((row) => row.user_id && row.user_id !== userId)
            .map((row) => [row.user_id, row])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name));

      if (mergedUsers.length === 0 && ownCompanyUsers.length === 0) {
        console.warn('Compose message loaded with no available recipients for current scope.', {
          companyId,
          userId,
          isDesignProfessional,
        });
      }

      setAvailableUsers(mergedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipient = (recipientUserId: string) => {
    const found = availableUsers.find(u => u.user_id === recipientUserId);
    if (found && !recipients.find(r => r.user_id === recipientUserId)) {
      setRecipients(prev => [...prev, found]);
      setSelectedUser('');
    }
  };

  const handleRemoveRecipient = (recipientUserId: string) => {
    setRecipients(prev => prev.filter(r => r.user_id !== recipientUserId));
  };

  const handleSendMessage = async () => {
    if (!subject.trim() || !message.trim() || recipients.length === 0) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all fields and select at least one recipient.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Use send_message RPC for each recipient
      for (const recipient of recipients) {
        const { error } = await supabase.rpc('send_message', {
          p_from_user_id: userId,
          p_to_user_id: recipient.user_id,
          p_company_id: companyId,
          p_subject: subject.trim(),
          p_content: message.trim(),
        });

        if (error) throw error;
      }

      await createMentionNotifications({
        companyId,
        actorUserId: userId,
        actorName,
        content: message.trim(),
        contextLabel: 'Messages',
        targetPath: isDesignProfessional ? '/design-professional/messages' : '/messages',
      });

      toast({
        title: 'Message Sent',
        description: `Message sent to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}.`,
      });

      // Reset form
      setRecipients([]);
      setSubject('');
      setMessage('');
      setPriority('normal');
      setOpen(false);
      onMessageSent?.();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAddAllByRole = (role: string) => {
    const roleUsers = availableUsers.filter(u => u.role === role);
    const newRecipients = roleUsers.filter(u => !recipients.find(r => r.id === u.id));
    setRecipients(prev => [...prev, ...newRecipients]);
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'bg-red-500 text-red-50';
      case 'high': return 'bg-orange-500 text-orange-50';
      case 'normal': return 'bg-blue-500 text-blue-50';
      case 'low': return 'bg-gray-500 text-gray-50';
      default: return 'bg-blue-500 text-blue-50';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Compose Message
          </DialogTitle>
          <DialogDescription>
            Send a message to team members
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipients Section */}
          <div>
            <Label>Recipients</Label>
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddAllByRole('admin')}>
                  <Users className="h-4 w-4 mr-1" /> Add All Admins
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddAllByRole('controller')}>
                  <Users className="h-4 w-4 mr-1" /> Add All Controllers
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddAllByRole('employee')}>
                  <Users className="h-4 w-4 mr-1" /> Add All Employees
                </Button>
              </div>

              <Select value={selectedUser} onValueChange={handleAddRecipient}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? 'Loading users...' : 'Select a user to add'} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers
                    .filter(u => !recipients.find(r => r.user_id === u.user_id))
                    .map(u => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            src={avatarMap[u.user_id] ?? u.avatar_url ?? null}
                            name={u.name}
                            className="h-5 w-5"
                            fallbackClassName="text-[10px]"
                          />
                          <span>{u.name}</span>
                          <Badge variant="outline" className="text-xs">{u.role}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {recipients.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Selected Recipients ({recipients.length})</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {recipients.map(recipient => (
                      <div key={recipient.user_id} className="flex items-center gap-2 bg-accent rounded-lg px-3 py-2">
                        <UserAvatar
                          src={avatarMap[recipient.user_id] ?? recipient.avatar_url ?? null}
                          name={recipient.name}
                          className="h-6 w-6"
                          fallbackClassName="text-xs"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{recipient.name}</p>
                          <p className="text-xs text-muted-foreground">{recipient.role}</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleRemoveRecipient(recipient.user_id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter message subject" />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <MentionTextarea
              id="message"
              value={message}
              onValueChange={setMessage}
              companyId={companyId}
              includeEmployeeMentions
              currentUserId={userId}
              placeholder="Type your message here... (use @ to tag teammates)"
              rows={6}
            />
          </div>

          {(subject || message) && (
            <div className="border rounded-lg p-4 bg-accent/50">
              <Label className="text-sm font-medium">Preview</Label>
              <div className="mt-2 space-y-2">
                {subject && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Subject:</span>
                    <span className="text-sm">{subject}</span>
                    <Badge className={getPriorityColor(priority)}>{priority.toUpperCase()}</Badge>
                  </div>
                )}
                {message && (
                  <div>
                    <span className="text-sm font-medium">Message:</span>
                    <p className="text-sm mt-1 max-h-20 overflow-y-auto">{message}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSendMessage} disabled={!subject.trim() || !message.trim() || recipients.length === 0}>
              <Send className="h-4 w-4 mr-2" /> Send Message
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Send, User, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import MentionTextarea from '@/components/MentionTextarea';
import { createMentionNotifications } from '@/utils/mentions';

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  subject: string | null;
  content: string;
  from_profile?: {
    display_name?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

interface User {
  user_id: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  avatar_url?: string | null;
}

interface MobileComposeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMessageSent: () => void;
  replyToMessage?: Message | null;
}

export function MobileComposeDialog({ isOpen, onClose, onMessageSent, replyToMessage }: MobileComposeDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [selectedUser, setSelectedUser] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchUsers();
      
      // Pre-fill for reply
      if (replyToMessage) {
        setSelectedUser(replyToMessage.from_user_id);
        setSubject(replyToMessage.subject ? `Re: ${replyToMessage.subject}` : 'Re: Your message');
        setMessage('');
      } else {
        setSelectedUser('');
        setSubject('');
        setMessage('');
      }
    }
  }, [isOpen, user, replyToMessage]);

  const fetchUsers = async () => {
    if (!user || !currentCompany) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_company_directory', { p_company_id: currentCompany.id });

      if (error) throw error;

      const companyUsers = ((data || []) as User[])
        .filter((row) => row.user_id && row.user_id !== user.id)
        .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));

      setAvailableUsers(companyUsers);
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

  const handleSendMessage = async () => {
    if (!subject.trim() || !message.trim() || !selectedUser) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all fields and select a recipient.',
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          from_user_id: user.id,
          to_user_id: selectedUser,
          subject,
          content: message,
          thread_id: replyToMessage?.id || null,
          company_id: currentCompany?.id
        });

      if (error) throw error;

      if (currentCompany?.id) {
        await createMentionNotifications({
          companyId: currentCompany.id,
          actorUserId: user.id,
          actorName:
            (user as any)?.user_metadata?.full_name ||
            (user as any)?.user_metadata?.name ||
            (user as any)?.email ||
            'A teammate',
          content: message.trim(),
          contextLabel: 'Messages',
          targetPath: '/messages',
        });
      }

      toast({
        title: 'Message Sent',
        description: 'Your message has been sent successfully.',
      });

      onMessageSent();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSelectedUser('');
    setSubject('');
    setMessage('');
    onClose();
  };

  const getDisplayName = (user: User) => {
    return user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.first_name || 'Unknown User';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {replyToMessage ? 'Reply to Message' : 'Compose Message'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient Selection */}
          <div>
            <Label htmlFor="recipient">To</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser} disabled={!!replyToMessage}>
              <SelectTrigger>
                <SelectValue placeholder="Select recipient" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map(user => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{getDisplayName(user)}</span>
                      {user.role && (
                        <Badge variant="outline" className="text-xs">
                          {user.role}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter message subject"
            />
          </div>

          {/* Message Content */}
          <div>
            <Label htmlFor="message">Message</Label>
            <MentionTextarea
              id="message"
              value={message}
              onValueChange={setMessage}
              companyId={currentCompany?.id}
              includeEmployeeMentions
              currentUserId={user?.id}
              placeholder="Type your message here... (use @ to tag teammates)"
              rows={6}
            />
          </div>

          {/* Reply Context */}
          {replyToMessage && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <Label className="text-sm font-medium">Replying to:</Label>
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium">
                  {replyToMessage.from_profile?.display_name || 
                   replyToMessage.from_profile?.first_name || 
                   'Unknown User'}
                </p>
                {replyToMessage.subject && (
                  <p className="text-sm text-muted-foreground">
                    Subject: {replyToMessage.subject}
                  </p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {replyToMessage.content}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-2 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={!subject.trim() || !message.trim() || !selectedUser || sending}
              className="flex-1"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MobileComposeDialog;

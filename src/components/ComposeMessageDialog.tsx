import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, Send, Users, User, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
}

export default function ComposeMessageDialog({ children, onMessageSent }: ComposeMessageDialogProps) {
  const { user } = useAuth();
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
  const companyId = currentCompany?.id || CURRENT_COMPANY_ID;

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, user_id, display_name, role,
          user_company_access!inner(company_id)
        `)
        .eq('user_company_access.company_id', companyId)
        .neq('user_id', userId);

      if (error) throw error;

      const users = (data || []).map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        name: profile.display_name || 'Unknown User',
        role: profile.role || 'employee'
      }));

      setAvailableUsers(users);
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
                  <SelectValue placeholder="Select a user to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers
                    .filter(u => !recipients.find(r => r.user_id === u.user_id))
                    .map(u => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
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
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {recipient.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
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
            <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message here..." rows={6} />
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

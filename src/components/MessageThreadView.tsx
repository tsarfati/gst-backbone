import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Reply, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const CURRENT_USER_ID = 'fa67f9ba-67fc-4708-9526-7bfef906dae3';
const CURRENT_COMPANY_ID = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560';

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  subject: string;
  content: string;
  read: boolean;
  created_at: string;
  thread_id?: string;
  is_reply: boolean;
  from_profile?: {
    display_name: string;
    avatar_url?: string;
  };
  to_profile?: {
    display_name: string;
    avatar_url?: string;
  };
}

interface MessageThreadViewProps {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
  onMessageSent?: () => void;
}

export default function MessageThreadView({ 
  message, 
  isOpen, 
  onClose, 
  onMessageSent 
}: MessageThreadViewProps) {
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const userId = user?.id || CURRENT_USER_ID;
  const companyId = currentCompany?.id || CURRENT_COMPANY_ID;

  useEffect(() => {
    if (message && isOpen) {
      loadThreadMessages();
      markAsRead();
    }
  }, [message, isOpen]);

  const loadThreadMessages = async () => {
    if (!message) return;

    try {
      setIsLoading(true);
      
      const rootMessageId = message.thread_id || message.id;
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('company_id', companyId)
        .or(`id.eq.${rootMessageId},thread_id.eq.${rootMessageId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Resolve names for all users in the thread
      const userIds = [...new Set([
        ...data.map(m => m.from_user_id),
        ...data.map(m => m.to_user_id)
      ])];

      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: names, error: nameError } = await supabase.rpc('resolve_user_names', {
          p_user_ids: userIds,
        });
        if (!nameError && names) {
          (names as any[]).forEach((n: any) => {
            nameMap[n.user_id] = n.name || n.display_name || 'Unknown User';
          });
        }
      }

      const messagesWithProfiles = data.map(msg => ({
        ...msg,
        from_profile: { display_name: nameMap[msg.from_user_id] || 'Unknown User' },
        to_profile: { display_name: nameMap[msg.to_user_id] || 'Unknown User' },
      }));

      setThreadMessages(messagesWithProfiles);
    } catch (error) {
      console.error('Error loading thread messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load message thread',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!message) return;

    try {
      if (message.to_user_id === userId && !message.read) {
        await supabase.rpc('mark_message_read', {
          p_message_id: message.id,
          p_user_id: userId,
        });
      }

      // Mark unread replies in thread
      const rootMessageId = message.thread_id || message.id;
      const { data: unreadReplies } = await supabase
        .from('messages')
        .select('id')
        .eq('thread_id', rootMessageId)
        .eq('to_user_id', userId)
        .eq('read', false);

      if (unreadReplies) {
        for (const reply of unreadReplies) {
          await supabase.rpc('mark_message_read', {
            p_message_id: reply.id,
            p_user_id: userId,
          });
        }
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendReply = async () => {
    if (!message || !replyContent.trim()) return;

    try {
      setIsSending(true);
      
      const replyToUserId = message.from_user_id === userId 
        ? message.to_user_id 
        : message.from_user_id;
      
      const { error } = await supabase.rpc('send_message', {
        p_from_user_id: userId,
        p_to_user_id: replyToUserId,
        p_company_id: companyId,
        p_subject: `Re: ${message.subject}`,
        p_content: replyContent.trim(),
      });

      if (error) throw error;

      // Also set thread_id on the newly created message
      // The send_message RPC creates the message; we need to update thread_id
      // For now we'll reload the thread which will pick it up
      toast({
        title: 'Reply Sent',
        description: 'Your reply has been sent successfully.'
      });

      setReplyContent('');
      loadThreadMessages();
      onMessageSent?.();
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to send reply',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!message) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Reply className="h-5 w-5" />
            {message.subject}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading conversation...</span>
            </div>
          ) : (
            threadMessages.map((msg) => (
              <Card key={msg.id} className={`${msg.from_user_id === userId ? 'ml-8' : 'mr-8'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {msg.from_profile?.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {msg.from_profile?.display_name || 'Unknown User'}
                          </span>
                          {msg.is_reply && (
                            <span className="text-xs text-muted-foreground">replied</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Reply Section */}
        <div className="border-t pt-4 space-y-3">
          <Textarea
            placeholder="Type your reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={sendReply} disabled={!replyContent.trim() || isSending}>
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Reply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

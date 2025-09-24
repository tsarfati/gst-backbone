import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Reply, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

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
      
      // Get the root message ID (either the message itself or its thread_id)
      const rootMessageId = message.thread_id || message.id;
      
      // Fetch all messages in the thread
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`id.eq.${rootMessageId},thread_id.eq.${rootMessageId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles for all unique user IDs
      const userIds = [...new Set([
        ...data.map(m => m.from_user_id),
        ...data.map(m => m.to_user_id)
      ])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const messagesWithProfiles = data.map(msg => ({
        ...msg,
        from_profile: profileMap.get(msg.from_user_id),
        to_profile: profileMap.get(msg.to_user_id)
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
    if (!message || !user) return;

    try {
      // Mark the main message as read if user is the recipient
      if (message.to_user_id === user.id && !message.read) {
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('id', message.id);
      }

      // Mark any unread replies as read
      const rootMessageId = message.thread_id || message.id;
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('thread_id', rootMessageId)
        .eq('to_user_id', user.id)
        .eq('read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendReply = async () => {
    if (!message || !user || !replyContent.trim()) return;

    try {
      setIsSending(true);
      
      // Determine who to reply to (original sender)
      const replyToUserId = message.from_user_id === user.id 
        ? message.to_user_id 
        : message.from_user_id;
      
      const rootMessageId = message.thread_id || message.id;

      const { error } = await supabase
        .from('messages')
        .insert({
          from_user_id: user.id,
          to_user_id: replyToUserId,
          subject: `Re: ${message.subject}`,
          content: replyContent.trim(),
          thread_id: rootMessageId,
          is_reply: true
        });

      if (error) throw error;

      toast({
        title: 'Reply Sent',
        description: 'Your reply has been sent successfully.'
      });

      setReplyContent('');
      loadThreadMessages(); // Reload to show the new reply
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
              <Card key={msg.id} className={`${msg.from_user_id === user?.id ? 'ml-8' : 'mr-8'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={msg.from_profile?.avatar_url} />
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
            <Button
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              onClick={sendReply}
              disabled={!replyContent.trim() || isSending}
            >
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
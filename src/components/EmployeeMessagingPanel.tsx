import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Send, User, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  subject?: string;
  content: string;
  created_at: string;
  read: boolean;
  sender_name?: string;
  sender_avatar?: string;
}

interface ProjectManager {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface EmployeeMessagingPanelProps {
  currentJobId?: string;
  isVisible: boolean;
}

export default function EmployeeMessagingPanel({ currentJobId, isVisible }: EmployeeMessagingPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [projectManager, setProjectManager] = useState<ProjectManager | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  useEffect(() => {
    if (isVisible && currentJobId) {
      loadProjectManager();
      loadMessages();
    }
  }, [isVisible, currentJobId]);

  const loadProjectManager = async () => {
    if (!currentJobId) return;

    try {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select(`
          project_manager_user_id,
          profiles!jobs_project_manager_user_id_fkey (
            user_id,
            display_name,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('id', currentJobId)
        .single();

      if (jobError) throw jobError;

      if (job?.profiles) {
        setProjectManager({
          id: job.profiles.user_id,
          user_id: job.profiles.user_id,
          display_name: job.profiles.display_name || `${job.profiles.first_name} ${job.profiles.last_name}`,
          first_name: job.profiles.first_name,
          last_name: job.profiles.last_name,
          avatar_url: job.profiles.avatar_url
        });
      }
    } catch (error) {
      console.error('Error loading project manager:', error);
    }
  };

  const loadMessages = async () => {
    if (!user || !projectManager || !currentCompany) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          from_profile:profiles!messages_from_user_id_fkey (
            display_name,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('company_id', currentCompany.id)
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${projectManager.user_id}),and(from_user_id.eq.${projectManager.user_id},to_user_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages = data?.map(msg => {
        const profile = msg.from_profile as any;
        return {
          ...msg,
          sender_name: profile?.display_name || 
            `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
            'Unknown User',
          sender_avatar: profile?.avatar_url
        };
      }) || [];

      setMessages(formattedMessages);

      // Mark received messages as read
      const unreadMessages = formattedMessages.filter(msg => 
        msg.to_user_id === user.id && !msg.read
      );

      if (unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ read: true })
          .in('id', unreadMessages.map(msg => msg.id));
      }

    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!user || !projectManager || !currentCompany || !newMessage.trim()) return;

    setSendingMessage(true);
    try {
      const messageSubject = subject.trim() || `Timecard Message - Job Site`;
      
      const { error } = await supabase
        .from('messages')
        .insert({
          from_user_id: user.id,
          to_user_id: projectManager.user_id,
          subject: messageSubject,
          content: newMessage.trim(),
          company_id: currentCompany.id
        });

      if (error) throw error;

      toast({
        title: 'Message Sent',
        description: 'Your message has been sent to the project manager.',
      });

      setNewMessage('');
      setSubject('');
      await loadMessages();

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSendingMessage(false);
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

  if (!isVisible || !currentJobId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Message Project Manager
          {projectManager && (
            <Badge variant="outline">
              {projectManager.display_name}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!projectManager ? (
          <div className="text-center py-4 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No project manager assigned to this job</p>
          </div>
        ) : (
          <>
            {/* Messages History */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="text-sm font-medium">Recent Messages</span>
              </div>
              
              <ScrollArea className="h-48 w-full border rounded-lg p-3">
                {loading ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No messages yet. Start a conversation!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div key={message.id} className="space-y-2">
                        <div className={`flex gap-3 ${message.from_user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex gap-2 max-w-[80%] ${message.from_user_id === user?.id ? 'flex-row-reverse' : 'flex-row'}`}>
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={message.sender_avatar} />
                              <AvatarFallback className="text-xs">
                                {getInitials(message.sender_name || 'U')}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`rounded-lg p-3 ${
                              message.from_user_id === user?.id 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted'
                            }`}>
                              <div className="text-sm">{message.content}</div>
                              <div className={`text-xs mt-1 flex items-center gap-1 ${
                                message.from_user_id === user?.id 
                                  ? 'text-primary-foreground/70' 
                                  : 'text-muted-foreground'
                              }`}>
                                <Clock className="h-3 w-3" />
                                {format(new Date(message.created_at), 'MMM dd, h:mm a')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <Separator />

            {/* Send New Message */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Input
                  placeholder="Message subject (optional)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
                <Textarea
                  placeholder="Type your message to the project manager..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                />
              </div>
              
              <Button 
                onClick={sendMessage} 
                disabled={!newMessage.trim() || sendingMessage}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendingMessage ? 'Sending...' : 'Send Message'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
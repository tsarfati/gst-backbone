import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Plus, Search, Reply, Archive, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';
import ComposeMessageDialog from '@/components/ComposeMessageDialog';
import MessageThreadView from '@/components/MessageThreadView';

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
}

export default function AllMessages() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'sent'>('all');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showThreadView, setShowThreadView] = useState(false);
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();

  useEffect(() => {
    if (user && currentCompany) {
      fetchMessages();
    }
  }, [user, currentCompany, filter]);

  // Handle URL parameters for opening specific message threads
  useEffect(() => {
    const threadId = searchParams.get('thread');
    if (threadId && messages.length > 0) {
      const message = messages.find(m => m.id === threadId);
      if (message) {
        openThreadView(message);
        // Clear the URL parameter after opening
        setSearchParams({});
      }
    }
  }, [messages, searchParams, setSearchParams]);

  // Handle URL parameters for opening specific message threads
  useEffect(() => {
    const threadId = searchParams.get('thread');
    if (threadId && messages.length > 0) {
      const message = messages.find(m => m.id === threadId);
      if (message) {
        openThreadView(message);
        // Clear the URL parameter after opening
        setSearchParams({});
      }
    }
  }, [messages, searchParams, setSearchParams]);

  const fetchMessages = async () => {
    if (!user || !currentCompany) return;

    try {
      let query = supabase.from('messages').select('*').eq('company_id', currentCompany.id);
      
      if (filter === 'sent') {
        query = query.eq('from_user_id', user.id);
      } else {
        query = query.eq('to_user_id', user.id);
        if (filter === 'unread') {
          query = query.eq('read', false);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sender profiles
      const messagesWithProfiles = await Promise.all(
        (data || []).map(async (message) => {
          const profileUserId = filter === 'sent' ? message.to_user_id : message.from_user_id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', profileUserId)
            .single();
          
          return {
            ...message,
            from_profile: profile
          };
        })
      );

      setMessages(messagesWithProfiles);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => 
        prev.map(m => m.id === messageId ? { ...m, read: true } : m)
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const openThreadView = (message: Message) => {
    setSelectedMessage(message);
    setShowThreadView(true);
    if (!message.read && filter !== 'sent') {
      markAsRead(message.id);
    }
  };

  const closeThreadView = () => {
    setShowThreadView(false);
    setSelectedMessage(null);
  };

  const handleMessageSent = () => {
    fetchMessages(); // Refresh messages list
  };

  const filteredMessages = messages.filter(message =>
    message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.from_profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-7 w-7" />
            Messages
          </h1>
          <p className="text-muted-foreground">
            Manage your team communications
          </p>
        </div>
        <ComposeMessageDialog>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Compose Message
          </Button>
        </ComposeMessageDialog>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex gap-2">
              <Button 
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All Messages
              </Button>
              <Button 
                variant={filter === 'unread' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('unread')}
              >
                Unread ({messages.filter(m => !m.read).length})
              </Button>
              <Button 
                variant={filter === 'sent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('sent')}
              >
                Sent
              </Button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filter === 'all' ? 'All Messages' : 
             filter === 'unread' ? 'Unread Messages' : 'Sent Messages'}
            <Badge variant="outline" className="ml-2">
              {filteredMessages.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading messages...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No messages found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try adjusting your search criteria' : 'No messages to display'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((message) => (
                <div
                  key={message.id}
                  className={`p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors ${
                    !message.read && filter !== 'sent' ? 'bg-accent/20 border-primary/20' : ''
                  }`}
                  onClick={() => openThreadView(message)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={message.from_profile?.avatar_url} />
                        <AvatarFallback>
                          {message.from_profile?.display_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium truncate ${!message.read && filter !== 'sent' ? 'font-semibold' : ''}`}>
                            {filter === 'sent' ? 'To: ' : 'From: '}{message.from_profile?.display_name || 'Unknown User'}
                          </h3>
                          {!message.read && filter !== 'sent' && (
                            <Badge variant="destructive" className="text-xs">New</Badge>
                          )}
                        </div>
                        <h4 className={`text-sm mb-2 ${!message.read && filter !== 'sent' ? 'font-medium' : 'text-muted-foreground'}`}>
                          {message.subject}
                        </h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.content}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(message.created_at).toLocaleDateString()} at {new Date(message.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          openThreadView(message);
                        }}
                      >
                        <Reply className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Star className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Thread View */}
      <MessageThreadView
        message={selectedMessage}
        isOpen={showThreadView}
        onClose={closeThreadView}
        onMessageSent={handleMessageSent}
      />
    </div>
  );
}
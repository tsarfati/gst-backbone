import { useState, useEffect, useCallback } from 'react';
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
  to_profile?: {
    display_name: string;
    avatar_url?: string;
  };
}

// Hardcoded user/company per requirements
const CURRENT_USER_ID = 'fa67f9ba-67fc-4708-9526-7bfef906dae3';
const CURRENT_COMPANY_ID = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560';

export default function AllMessages() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'sent'>('all');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showThreadView, setShowThreadView] = useState(false);
  const { user } = useAuth();
  const { currentCompany } = useCompany();

  const userId = user?.id || CURRENT_USER_ID;
  const companyId = currentCompany?.id || CURRENT_COMPANY_ID;

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);

      // Use the get_user_messages RPC to fetch ALL messages (sent & received)
      const { data, error } = await supabase.rpc('get_user_messages', {
        p_user_id: userId,
        p_company_id: companyId,
      });

      if (error) throw error;

      const rawMessages = (data || []) as any[];

      // Collect all unique user IDs for name resolution
      const userIdSet = new Set<string>();
      rawMessages.forEach((m) => {
        if (m.from_user_id) userIdSet.add(m.from_user_id);
        if (m.to_user_id) userIdSet.add(m.to_user_id);
      });

      // Resolve display names (handles both auth users and pin_employees)
      let nameMap: Record<string, string> = {};
      if (userIdSet.size > 0) {
        const { data: names, error: nameError } = await supabase.rpc('resolve_user_names', {
          p_user_ids: Array.from(userIdSet),
        });
        if (!nameError && names) {
          (names as any[]).forEach((n: any) => {
            nameMap[n.user_id] = n.name || n.display_name || 'Unknown User';
          });
        }
      }

      // Map messages with resolved profiles
      const messagesWithProfiles: Message[] = rawMessages.map((m) => ({
        id: m.id,
        from_user_id: m.from_user_id,
        to_user_id: m.to_user_id,
        subject: m.subject || '(No Subject)',
        content: m.content || '',
        read: m.read ?? false,
        created_at: m.created_at,
        thread_id: m.thread_id,
        is_reply: m.is_reply ?? false,
        from_profile: {
          display_name: nameMap[m.from_user_id] || 'Unknown User',
        },
        to_profile: {
          display_name: nameMap[m.to_user_id] || 'Unknown User',
        },
      }));

      // Sort newest first
      messagesWithProfiles.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
  }, [userId, companyId, toast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Handle URL parameters for opening specific message threads
  useEffect(() => {
    const threadId = searchParams.get('thread');
    if (threadId && messages.length > 0) {
      const message = messages.find((m) => m.id === threadId);
      if (message) {
        openThreadView(message);
        setSearchParams({});
      }
    }
  }, [messages, searchParams, setSearchParams]);

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase.rpc('mark_message_read', {
        p_message_id: messageId,
        p_user_id: userId,
      });

      if (error) throw error;

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, read: true } : m))
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const openThreadView = (message: Message) => {
    setSelectedMessage(message);
    setShowThreadView(true);
    if (!message.read && message.to_user_id === userId) {
      markAsRead(message.id);
    }
  };

  const closeThreadView = () => {
    setShowThreadView(false);
    setSelectedMessage(null);
  };

  const handleMessageSent = () => {
    fetchMessages();
  };

  // Apply client-side filters
  const filteredMessages = messages.filter((message) => {
    // Filter by tab
    if (filter === 'sent' && message.from_user_id !== userId) return false;
    if (filter === 'unread' && (message.read || message.from_user_id === userId)) return false;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        message.subject.toLowerCase().includes(term) ||
        message.content.toLowerCase().includes(term) ||
        message.from_profile?.display_name?.toLowerCase().includes(term) ||
        message.to_profile?.display_name?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const unreadCount = messages.filter(
    (m) => !m.read && m.to_user_id === userId
  ).length;

  const getDisplayName = (message: Message) => {
    if (filter === 'sent' || message.from_user_id === userId) {
      return `To: ${message.to_profile?.display_name || 'Unknown User'}`;
    }
    return `From: ${message.from_profile?.display_name || 'Unknown User'}`;
  };

  const getAvatarName = (message: Message) => {
    if (filter === 'sent' || message.from_user_id === userId) {
      return message.to_profile?.display_name || 'U';
    }
    return message.from_profile?.display_name || 'U';
  };

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
        <ComposeMessageDialog onMessageSent={handleMessageSent}>
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
                Unread ({unreadCount})
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
            {filter === 'all'
              ? 'All Messages'
              : filter === 'unread'
              ? 'Unread Messages'
              : 'Sent Messages'}
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
                {searchTerm
                  ? 'Try adjusting your search criteria'
                  : 'No messages to display'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((message) => {
                const isReceived = message.to_user_id === userId;
                const isUnread = !message.read && isReceived;

                return (
                  <div
                    key={message.id}
                    className={`p-4 border rounded-lg cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors ${
                      isUnread ? 'bg-accent/20 border-primary/20' : ''
                    }`}
                    onClick={() => openThreadView(message)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {getAvatarName(message).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3
                              className={`font-medium truncate ${
                                isUnread ? 'font-semibold' : ''
                              }`}
                            >
                              {getDisplayName(message)}
                            </h3>
                            {isUnread && (
                              <Badge variant="destructive" className="text-xs">
                                New
                              </Badge>
                            )}
                          </div>
                          <h4
                            className={`text-sm mb-2 ${
                              isUnread
                                ? 'font-medium'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {message.subject}
                          </h4>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {message.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(message.created_at).toLocaleDateString()}{' '}
                            at{' '}
                            {new Date(message.created_at).toLocaleTimeString()}
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
                );
              })}
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

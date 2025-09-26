import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, User, Search, Plus, Reply } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import MobileComposeDialog from "@/components/MobileComposeDialog";

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  subject: string | null;
  content: string;
  read: boolean;
  created_at: string;
  thread_id?: string;
  from_profile?: {
    display_name?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
  to_profile?: {
    display_name?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

export function MobileMessages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (user) {
      loadMessages();
      
      // Set up real-time subscription for new messages
      const channel = supabase
        .channel('messages_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `to_user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('New message received:', payload);
            // Reload messages to get the latest data with profiles
            loadMessages();
            
            // Show toast notification for new message
            toast({
              title: 'New Message',
              description: 'You have received a new message',
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `to_user_id=eq.${user.id}`
          },
          (payload) => {
            // Update message read status in real-time
            if (payload.new.read !== payload.old.read) {
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === payload.new.id 
                    ? { ...msg, read: payload.new.read }
                    : msg
                )
              );
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          from_user_id,
          to_user_id,
          subject,
          content,
          read,
          created_at,
          thread_id
        `)
        .or(`from_user_id.eq.${user?.id},to_user_id.eq.${user?.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch profile data and avatars separately for better reliability
      const userIds = [...new Set([
        ...data.map(m => m.from_user_id),
        ...data.map(m => m.to_user_id)
      ])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const messagesWithProfiles = data.map(message => ({
        ...message,
        from_profile: profileMap.get(message.from_user_id),
        to_profile: profileMap.get(message.to_user_id)
      }));

      setMessages(messagesWithProfiles);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive'
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
        .eq('id', messageId)
        .eq('to_user_id', user?.id);

      if (!error) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId ? { ...msg, read: true } : msg
          )
        );
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleReply = (message: Message) => {
    setReplyToMessage(message);
    setShowCompose(true);
  };

  const handleMessageSent = () => {
    setShowCompose(false);
    setReplyToMessage(null);
    loadMessages();
  };

  const filteredMessages = messages.filter(message => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const fromName = message.from_profile?.display_name || 
                    message.from_profile?.first_name || 
                    'Unknown';
    const toName = message.to_profile?.display_name || 
                  message.to_profile?.first_name || 
                  'Unknown';
    
    return (
      message.subject?.toLowerCase().includes(searchLower) ||
      message.content.toLowerCase().includes(searchLower) ||
      fromName.toLowerCase().includes(searchLower) ||
      toName.toLowerCase().includes(searchLower)
    );
  });

  const unreadCount = messages.filter(msg => !msg.read && msg.to_user_id === user?.id).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-accent/20 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/pm-mobile')}
                className="p-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Messages
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {unreadCount} new
                    </Badge>
                  )}
                </CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowCompose(true)}
                className="p-2"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Search */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardContent className="p-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-sm text-muted-foreground">Loading messages...</p>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? 'No messages found matching your search' : 'No messages yet'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[60vh]">
                <div className="space-y-3">
                  {filteredMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                        !message.read && message.to_user_id === user?.id 
                          ? 'bg-primary/5 border-primary/20' 
                          : 'bg-background'
                      }`}
                      onClick={() => {
                        if (!message.read && message.to_user_id === user?.id) {
                          markAsRead(message.id);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              {message.from_user_id === user?.id ? (
                                <>
                                  {user?.user_metadata?.avatar_url || message.from_profile?.avatar_url ? (
                                    <img 
                                      src={user?.user_metadata?.avatar_url || message.from_profile?.avatar_url} 
                                      alt="Your Avatar"
                                      className="h-6 w-6 rounded-full"
                                    />
                                  ) : (
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                      <User className="h-3 w-3 text-primary" />
                                    </div>
                                  )}
                                  <span className="text-sm font-medium">You</span>
                                  <span className="text-xs text-muted-foreground">→</span>
                                  <span className="text-xs text-muted-foreground">
                                    {message.to_profile?.display_name || 
                                     message.to_profile?.first_name || 
                                     'Unknown User'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  {message.from_profile?.avatar_url ? (
                                    <img 
                                      src={message.from_profile.avatar_url} 
                                      alt={message.from_profile.display_name || message.from_profile.first_name || 'User'} 
                                      className="h-6 w-6 rounded-full"
                                    />
                                  ) : (
                                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                      <User className="h-3 w-3" />
                                    </div>
                                  )}
                                  <span className="text-sm font-medium">
                                    {message.from_profile?.display_name || 
                                     message.from_profile?.first_name || 
                                     'Unknown User'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">→ You</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {message.subject && (
                            <p className="text-sm font-medium text-primary mb-1 truncate">
                              {message.subject}
                            </p>
                          )}
                          
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {message.content}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              {new Date(message.created_at).toLocaleString()}
                            </p>
                            
                            {message.from_user_id !== user?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReply(message);
                                }}
                                className="h-6 px-2"
                              >
                                <Reply className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {!message.read && message.to_user_id === user?.id && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            New
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Refresh Button */}
        <Button 
          onClick={loadMessages}
          className="w-full"
          variant="outline"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Messages'}
        </Button>

        {/* Compose Message Dialog */}
        <MobileComposeDialog 
          isOpen={showCompose}
          onClose={() => {
            setShowCompose(false);
            setReplyToMessage(null);
          }}
          onMessageSent={handleMessageSent}
          replyToMessage={replyToMessage}
        />
      </div>
    </div>
  );
}

export default MobileMessages;
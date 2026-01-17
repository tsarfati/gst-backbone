import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Send, MessageCircle, Users, Search, Plus, AtSign, Hash } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ChatMessage {
  id: string;
  content: string;
  from_user_id: string;
  from_user_name: string;
  created_at: string;
  channel?: string;
  mentions?: string[]; // user IDs that were mentioned
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  is_general?: boolean;
}

interface OnlineUser {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'offline';
  avatar_url?: string | null;
}

// Parse @mentions and #hashtags from message content
const parseMessageContent = (content: string) => {
  const mentionRegex = /@(\w+(?:\s\w+)?)/g;
  const hashtagRegex = /#(\w+)/g;
  
  const mentions = [...content.matchAll(mentionRegex)].map(m => m[1]);
  const hashtags = [...content.matchAll(hashtagRegex)].map(m => m[1]);
  
  return { mentions, hashtags };
};

// Render message content with highlighted @mentions and #hashtags
const RenderMessageContent = ({ content, allUsers }: { content: string; allUsers: OnlineUser[] }) => {
  const parts = content.split(/(@\w+(?:\s\w+)?|#\w+)/g);
  
  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const userName = part.slice(1);
          const mentionedUser = allUsers.find(u => 
            u.name.toLowerCase() === userName.toLowerCase() ||
            u.name.toLowerCase().startsWith(userName.toLowerCase())
          );
          return (
            <span 
              key={index} 
              className="bg-primary/20 text-primary rounded px-1 font-medium cursor-pointer hover:bg-primary/30"
              title={mentionedUser ? mentionedUser.name : userName}
            >
              {part}
            </span>
          );
        }
        if (part.startsWith('#')) {
          return (
            <span 
              key={index} 
              className="bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded px-1 font-medium cursor-pointer hover:bg-blue-500/30"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default function TeamChat() {
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channels, setChannels] = useState<Channel[]>([
    {
      id: 'general',
      name: 'general',
      description: 'General team discussions',
      member_count: 5,
      is_general: true
    },
    {
      id: 'project-updates',
      name: 'project-updates',
      description: 'Project status and updates',
      member_count: 3
    }
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState<OnlineUser[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [currentUserName, setCurrentUserName] = useState('');
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  
  // Mention/hashtag autocomplete state
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [showHashtagPopover, setShowHashtagPopover] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [hashtagSearch, setHashtagSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Common hashtags for quick access
  const commonHashtags = useMemo(() => [
    'urgent', 'followup', 'question', 'update', 'meeting', 'deadline', 'review', 'help', 'fyi', 'important'
  ], []);

  useEffect(() => {
    if (profile) {
      const displayName = profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';
      setCurrentUserName(displayName);
    }
  }, [profile]);

  // Fetch all users from the database
  useEffect(() => {
    if (user) {
      fetchAllUsers();
    }
  }, [user, currentUserName]);

  // Set up presence tracking
  useEffect(() => {
    if (!user || !currentUserName) return;

    const presenceChannel = supabase.channel('team-chat-presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();

        // With presence.key set to user.id, the keys of this object are the online user_ids.
        const onlineIds = new Set<string>(Object.keys(state));

        // Fallback: also scan payloads for user_id if present (older sessions / mixed keys)
        Object.values(state).forEach((presences: any[]) => {
          presences.forEach((presence) => {
            if (presence?.user_id) onlineIds.add(presence.user_id);
          });
        });

        setOnlineUserIds(onlineIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            user_name: currentUserName,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [user, currentUserName]);

  const fetchAllUsers = async () => {
    if (!user || !profile?.current_company_id) return;

    try {
      // Query only users who have active access to the current company
      const { data: companyUsers, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id, is_active')
        .eq('company_id', profile.current_company_id)
        .eq('is_active', true);

      if (accessError) throw accessError;

      const userIds = (companyUsers || []).map((u: any) => u.user_id);
      
      if (userIds.length === 0) {
        // Only show current user if no other users found
        setAllUsers([{
          id: user.id,
          name: currentUserName || 'You',
          role: (profile?.role as unknown as string) || 'employee',
          status: 'offline' as const,
        }]);
        return;
      }

      // Fetch profile details for those users
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, role, status, avatar_url')
        .in('user_id', userIds);

      if (error) throw error;

      // Hide deleted/inactive profiles
      const activeProfiles = (data || []).filter((p: any) => {
        const s = String(p?.status || '').toLowerCase();
        return s !== 'deleted' && s !== 'inactive' && s !== 'disabled';
      });

      const usersFromDb: OnlineUser[] = activeProfiles.map((p: any) => ({
        id: p.user_id,
        name: p.display_name || 'Unknown User',
        role: p.role || 'employee',
        status: 'offline' as const,
        avatar_url: p.avatar_url,
      }));

      // Ensure current user is included in the list
      const me: OnlineUser = {
        id: user.id,
        name: currentUserName || 'You',
        role: (profile?.role as unknown as string) || 'employee',
        status: 'offline' as const,
        avatar_url: profile?.avatar_url,
      };

      const byId = new Map<string, OnlineUser>();
      [...usersFromDb, me].forEach((u) => byId.set(u.id, u));

      setAllUsers(Array.from(byId.values()));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Compute online users based on presence tracking
  const onlineUsers = allUsers.map((u) => ({
    ...u,
    status: onlineUserIds.has(u.id) ? ('online' as const) : ('offline' as const),
  }));
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  useEffect(() => {
    if (selectedChannel) {
      setMessages([]);
    }
  }, [selectedChannel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !selectedChannel) return;

    const { mentions, hashtags } = parseMessageContent(newMessage);
    
    // Find mentioned user IDs
    const mentionedUserIds: string[] = [];
    mentions.forEach(mentionName => {
      const mentionedUser = allUsers.find(u => 
        u.name.toLowerCase() === mentionName.toLowerCase() ||
        u.name.toLowerCase().startsWith(mentionName.toLowerCase())
      );
      if (mentionedUser && mentionedUser.id !== user.id) {
        mentionedUserIds.push(mentionedUser.id);
      }
    });

    const message: ChatMessage = {
      id: Date.now().toString(),
      content: newMessage,
      from_user_id: user.id,
      from_user_name: currentUserName || 'User',
      created_at: new Date().toISOString(),
      channel: selectedChannel.id,
      mentions: mentionedUserIds
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
    setShowMentionPopover(false);
    setShowHashtagPopover(false);

    // Create notifications for mentioned users
    if (mentionedUserIds.length > 0 && currentCompany) {
      for (const mentionedUserId of mentionedUserIds) {
        try {
          await supabase.from('notifications').insert({
            user_id: mentionedUserId,
            title: 'You were mentioned in Team Chat',
            message: `${currentUserName} mentioned you in #${selectedChannel.name}: "${newMessage.substring(0, 100)}${newMessage.length > 100 ? '...' : ''}"`,
            type: 'chat_mention',
            read: false
          });
        } catch (error) {
          console.error('Error creating mention notification:', error);
        }
      }
    }

    toast({
      title: 'Message Sent',
      description: `Message sent to #${selectedChannel.name}${mentionedUserIds.length > 0 ? ` (${mentionedUserIds.length} mentioned)` : ''}`,
    });
  };

  // Handle input change with @mention and #hashtag detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Check for @mention trigger
    const lastAtIndex = value.lastIndexOf('@');
    const lastHashIndex = value.lastIndexOf('#');
    const lastSpaceIndex = Math.max(value.lastIndexOf(' '), value.lastIndexOf('\n'));
    
    if (lastAtIndex > lastSpaceIndex) {
      const searchText = value.substring(lastAtIndex + 1);
      setMentionSearch(searchText);
      setShowMentionPopover(true);
      setShowHashtagPopover(false);
    } else if (lastHashIndex > lastSpaceIndex) {
      const searchText = value.substring(lastHashIndex + 1);
      setHashtagSearch(searchText);
      setShowHashtagPopover(true);
      setShowMentionPopover(false);
    } else {
      setShowMentionPopover(false);
      setShowHashtagPopover(false);
    }
  };

  // Insert mention into message
  const insertMention = (userName: string) => {
    const lastAtIndex = newMessage.lastIndexOf('@');
    const beforeMention = newMessage.substring(0, lastAtIndex);
    setNewMessage(`${beforeMention}@${userName} `);
    setShowMentionPopover(false);
    inputRef.current?.focus();
  };

  // Insert hashtag into message
  const insertHashtag = (hashtag: string) => {
    const lastHashIndex = newMessage.lastIndexOf('#');
    const beforeHashtag = newMessage.substring(0, lastHashIndex);
    setNewMessage(`${beforeHashtag}#${hashtag} `);
    setShowHashtagPopover(false);
    inputRef.current?.focus();
  };

  // Filter users for mention autocomplete
  const filteredMentionUsers = useMemo(() => {
    return allUsers.filter(u => 
      u.id !== user?.id && 
      u.name.toLowerCase().includes(mentionSearch.toLowerCase())
    ).slice(0, 5);
  }, [allUsers, mentionSearch, user?.id]);

  // Filter hashtags for autocomplete
  const filteredHashtags = useMemo(() => {
    return commonHashtags.filter(h => 
      h.toLowerCase().includes(hashtagSearch.toLowerCase())
    ).slice(0, 5);
  }, [commonHashtags, hashtagSearch]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar - Channels & Users */}
      <div className="w-80 border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold mb-4">Team Chat</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search channels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {/* Channels */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">CHANNELS</h3>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {filteredChannels.map((channel) => (
                <div
                  key={channel.id}
                  className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedChannel?.id === channel.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-primary/10'
                  }`}
                  onClick={() => setSelectedChannel(channel)}
                >
                  <span className="mr-2">#</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{channel.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{channel.member_count}</span>
                    </div>
                    {channel.description && (
                      <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Team Members */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              TEAM MEMBERS ({onlineUsers.filter(u => u.status === 'online').length} online)
            </h3>
            <div className="space-y-2">
              {/* Show online users first, then offline */}
              {[...onlineUsers]
                .sort((a, b) => {
                  if (a.status === 'online' && b.status !== 'online') return -1;
                  if (a.status !== 'online' && b.status === 'online') return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((teamUser) => (
                <div key={teamUser.id} className="flex items-center p-2 rounded-lg hover:bg-primary/10 hover:border-primary cursor-pointer">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      {teamUser.avatar_url && (
                        <AvatarImage src={teamUser.avatar_url} alt={teamUser.name} />
                      )}
                      <AvatarFallback className="text-xs">
                        {teamUser.name.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(teamUser.status)}`} />
                  </div>
                  <span className={`ml-3 text-sm ${teamUser.status === 'offline' ? 'text-muted-foreground' : ''}`}>
                    {teamUser.name}{teamUser.id === user?.id ? ' (You)' : ''}
                  </span>
                </div>
              ))}
              {onlineUsers.length === 0 && (
                <p className="text-sm text-muted-foreground">No team members found</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannel ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold flex items-center">
                    <span className="mr-2">#</span>
                    {selectedChannel.name}
                  </h1>
                  {selectedChannel.description && (
                    <p className="text-sm text-muted-foreground">{selectedChannel.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedChannel.member_count} members</Badge>
                  <Button size="sm" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Members
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages
                  .filter(msg => msg.channel === selectedChannel.id)
                  .map((message) => (
                    <div key={message.id} className="flex items-start space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {message.from_user_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{message.from_user_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.created_at)}
                          </span>
                        </div>
                        <p className="text-sm mt-1">
                          <RenderMessageContent content={message.content} allUsers={allUsers} />
                        </p>
                      </div>
                    </div>
                  ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-card">
              <div className="space-y-2">
                {/* Quick action hints */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <AtSign className="h-3 w-3" /> @mention users
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" /> #hashtag topics
                  </span>
                </div>
                
                <div className="relative">
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Input
                        ref={inputRef}
                        placeholder={`Message #${selectedChannel.name} - Use @ to mention, # for topics`}
                        value={newMessage}
                        onChange={handleInputChange}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !showMentionPopover && !showHashtagPopover) {
                            handleSendMessage();
                          }
                        }}
                        className="flex-1"
                      />
                      
                      {/* Mention Autocomplete Popover */}
                      {showMentionPopover && filteredMentionUsers.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-md shadow-lg z-50">
                          <div className="p-2">
                            <p className="text-xs text-muted-foreground mb-2">Mention a team member</p>
                            {filteredMentionUsers.map((u) => (
                              <div
                                key={u.id}
                                className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                                onClick={() => insertMention(u.name)}
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {u.name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{u.name}</span>
                                <div className={`ml-auto h-2 w-2 rounded-full ${getStatusColor(u.status)}`} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Hashtag Autocomplete Popover */}
                      {showHashtagPopover && filteredHashtags.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-1 w-48 bg-popover border rounded-md shadow-lg z-50">
                          <div className="p-2">
                            <p className="text-xs text-muted-foreground mb-2">Add a topic tag</p>
                            {filteredHashtags.map((hashtag) => (
                              <div
                                key={hashtag}
                                className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                                onClick={() => insertHashtag(hashtag)}
                              >
                                <Hash className="h-4 w-4 text-blue-500" />
                                <span className="text-sm">{hashtag}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a Channel</h3>
              <p className="text-muted-foreground">Choose a channel from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
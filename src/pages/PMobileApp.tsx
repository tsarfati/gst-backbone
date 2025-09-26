import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, FileText, Scan, Upload, CheckCircle, User, LogOut, MessageSquare, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PMReceiptScanner } from '@/components/PMReceiptScanner';
import { DeliveryTicketForm } from '@/components/DeliveryTicketForm';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

function PMobileApp() {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [showMessages, setShowMessages] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Load messages for current user
  useEffect(() => {
    if (user) {
      loadMessages();
    }
  }, [user]);

  const loadMessages = async () => {
    try {
      setLoadingMessages(true);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          from_profile:profiles!from_user_id(user_id, display_name, first_name, last_name),
          to_profile:profiles!to_user_id(user_id, display_name, first_name, last_name)
        `)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading messages:', error);
        // Fallback query without joins if the relationship queries fail
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('messages')
          .select('*')
          .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (fallbackError) throw fallbackError;
        setMessages(fallbackData || []);
      } else {
        setMessages(data || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: 'Sign Out Error',
        description: 'There was an issue signing out. Please try again.',
        variant: 'destructive'
      });
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-accent/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-accent/20 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="secondary" className="text-xs">
                Project Manager
              </Badge>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                className="h-8 w-8 p-0"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-3 justify-center mb-2">
              {user?.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="User Avatar"
                  className="h-10 w-10 rounded-full border-2 border-primary/20"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                  <User className="h-5 w-5 text-primary" />
                </div>
              )}
              <span className="font-semibold text-lg">
                {profile?.display_name || profile?.first_name || user?.user_metadata?.full_name || 'Project Manager'}
              </span>
            </div>
            <div className="text-3xl font-bold text-primary">
              {currentTime.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
            <div className="text-sm text-muted-foreground">
              {currentTime.toLocaleDateString([], { 
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </CardHeader>
        </Card>

        {/* Main Content */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardContent className="p-0">
            <Tabs defaultValue="scanner" className="w-full">
              <TabsList className="grid w-full grid-cols-2 m-4 mb-0">
                <TabsTrigger value="scanner" className="flex items-center gap-2">
                  <Scan className="h-4 w-4" />
                  Receipt Scanner
                </TabsTrigger>
                <TabsTrigger value="delivery" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Delivery Ticket
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="scanner" className="p-4 space-y-4">
                <div className="text-center mb-6">
                  <Camera className="h-12 w-12 text-primary mx-auto mb-2" />
                  <h3 className="text-lg font-semibold mb-1">Receipt Scanner</h3>
                  <p className="text-sm text-muted-foreground">
                    Take a photo of receipts and code them to jobs
                  </p>
                </div>
                <PMReceiptScanner />
              </TabsContent>
              
              <TabsContent value="delivery" className="p-4 space-y-4">
                <div className="text-center mb-6">
                  <FileText className="h-12 w-12 text-primary mx-auto mb-2" />
                  <h3 className="text-lg font-semibold mb-1">Delivery Ticket</h3>
                  <p className="text-sm text-muted-foreground">
                    Record material deliveries on site
                  </p>
                </div>
                <DeliveryTicketForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary mb-1">
                <Upload className="h-6 w-6 mx-auto mb-1" />
                0
              </div>
              <div className="text-xs text-muted-foreground">
                Today's Uploads
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                <CheckCircle className="h-6 w-6 mx-auto mb-1" />
                0
              </div>
              <div className="text-xs text-muted-foreground">
                Tickets Processed
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick Access</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start h-12"
              onClick={() => navigate('/jobs')}
            >
              <FileText className="h-4 w-4 mr-3" />
              View All Jobs
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-12"
              onClick={() => navigate('/receipts')}
            >
              <Scan className="h-4 w-4 mr-3" />
              Coded Receipts
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-12"
              onClick={() => navigate('/delivery-tickets')}
            >
              <FileText className="h-4 w-4 mr-3" />
              All Delivery Tickets
            </Button>
          </CardContent>
        </Card>

        {/* Messages Section */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages
                {messages.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {messages.length}
                  </Badge>
                )}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowMessages(!showMessages)}
              >
                {showMessages ? 'Hide' : 'Show'}
              </Button>
            </div>
          </CardHeader>
          {showMessages && (
            <CardContent className="pt-0">
              {loadingMessages ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  <p className="text-xs text-muted-foreground mt-2">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No messages yet</p>
                </div>
              ) : (
                <ScrollArea className="h-48">
                  <div className="space-y-3">
                     {messages.map((message) => (
                       <div key={message.id} className="border rounded-lg p-3 bg-muted/50">
                         <div className="flex items-start justify-between mb-2">
                           <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                               <div className="flex items-center gap-2">
                                 {message.from_user_id === user.id ? (
                                   <>
                                     {user?.user_metadata?.avatar_url ? (
                                       <img 
                                         src={user.user_metadata.avatar_url} 
                                         alt="Your Avatar"
                                         className="h-6 w-6 rounded-full"
                                       />
                                     ) : (
                                       <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                         <User className="h-3 w-3 text-primary" />
                                       </div>
                                     )}
                                     <span className="text-xs font-medium">You</span>
                                   </>
                                 ) : (
                                   <>
                                     <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                       <User className="h-3 w-3" />
                                     </div>
                                     <span className="text-xs font-medium">
                                       {message.from_profile?.display_name || 
                                        message.from_profile?.first_name || 
                                        'Unknown User'}
                                     </span>
                                   </>
                                 )}
                               </div>
                               {message.from_user_id !== user.id && (
                                 <span className="text-xs text-muted-foreground">
                                   → You
                                 </span>
                               )}
                               {message.from_user_id === user.id && (
                                 <span className="text-xs text-muted-foreground">
                                   → {message.to_profile?.display_name || 
                                       message.to_profile?.first_name || 
                                       'Unknown User'}
                                 </span>
                               )}
                             </div>
                            {message.subject && (
                              <p className="text-xs font-medium text-primary mb-1">
                                {message.subject}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {message.content}
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground ml-2">
                            {new Date(message.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        {!message.read && message.to_user_id === user.id && (
                          <Badge variant="secondary" className="text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <div className="mt-4 flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => navigate('/messages')}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  View All Messages
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={loadMessages}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

export default PMobileApp;
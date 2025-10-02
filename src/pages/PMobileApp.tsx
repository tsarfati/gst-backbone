import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, FileText, Scan, Upload, CheckCircle, User, LogOut, MessageSquare } from 'lucide-react';
import { usePunchClockAuth } from '@/contexts/PunchClockAuthContext';
import { PMReceiptScanner } from '@/components/PMReceiptScanner';
import { DeliveryTicketForm } from '@/components/DeliveryTicketForm';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PushNotificationService } from '@/utils/pushNotifications';

function PMobileApp() {
  const { user, profile, signOut } = usePunchClockAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!user) {
      navigate('/pm-mobile-login');
    }
  }, [user, navigate]);

  // Load unread message count and set up real-time updates
  useEffect(() => {
    if (user) {
      loadUnreadCount();
      
      const userId = 'id' in user ? user.id : user.user_id;
      
      // Set up real-time subscription for message updates
      const channel = supabase
        .channel('message_badge_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `to_user_id=eq.${userId}`
          },
          (payload) => {
            console.log('New message received for badge:', payload);
            loadUnreadCount();
            
            // Update badge count and show notification
            const newCount = unreadMessageCount + 1;
            PushNotificationService.updateBadgeCount(newCount);
            PushNotificationService.scheduleLocalNotification(
              'New Message',
              'You have received a new message',
              newCount
            );
            
            // Show toast notification
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
            filter: `to_user_id=eq.${userId}`
          },
          (payload) => {
            // Update count when messages are marked as read
            if (payload.new.read !== payload.old.read) {
              loadUnreadCount();
              // Update badge when messages are read
              setTimeout(() => {
                PushNotificationService.updateBadgeCount(unreadMessageCount - 1);
              }, 500);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, navigate]);

  const loadUnreadCount = async () => {
    try {
      const userId = 'id' in user ? user.id : user?.user_id;
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', userId)
        .eq('read', false);

      if (error) throw error;
      setUnreadMessageCount(count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      localStorage.removeItem('pm_mobile_user');
      navigate('/pm-mobile-login');
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
                className="text-xs h-6 px-2"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Sign Out
              </Button>
            </div>
            <div className="flex items-center gap-3 mb-2">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="User Avatar"
                  className="h-12 w-12 rounded-full border-2 border-primary/20"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
              )}
              <div className="text-left">
                <CardTitle className="text-lg">
                  Welcome, {profile?.display_name || profile?.first_name || 'User'}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {currentTime.toLocaleDateString()} • {currentTime.toLocaleTimeString()}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Scanner */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-center">Receipt & Delivery Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="scanner" className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="scanner" className="text-xs">Receipt Scanner</TabsTrigger>
                <TabsTrigger value="delivery" className="text-xs">Delivery Ticket</TabsTrigger>
              </TabsList>
              
              <TabsContent value="scanner" className="mt-0">
                <PMReceiptScanner />
              </TabsContent>
              
              <TabsContent value="delivery" className="mt-0">
                <DeliveryTicketForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">5</div>
              <div className="text-xs text-muted-foreground">
                Today's Uploads
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">12</div>
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
            <Button 
              variant="ghost" 
              className="w-full justify-start h-12 relative"
              onClick={() => navigate('/mobile-messages')}
            >
              <MessageSquare className="h-4 w-4 mr-3" />
              Messages
              {unreadMessageCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </Badge>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PMobileApp;
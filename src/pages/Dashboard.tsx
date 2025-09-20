import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import DashboardCustomizer from '@/components/DashboardCustomizer';
import { Receipt, Clock, CheckCircle, DollarSign, Settings, Bell, MessageSquare, X } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

interface Message {
  id: string;
  from_user_id: string;
  subject: string;
  content: string;
  read: boolean;
  created_at: string;
  from_profile?: {
    display_name: string;
  };
}

interface DashboardSettings {
  show_stats: boolean;
  show_recent_activity: boolean;
  show_active_jobs: boolean;
  show_notifications: boolean;
  show_messages: boolean;
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({
    show_stats: true,
    show_recent_activity: true,
    show_active_jobs: true,
    show_notifications: true,
    show_messages: true,
  });

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchMessages();
      fetchDashboardSettings();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchMessages = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('to_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      // Fetch sender profiles separately
      const messagesWithProfiles = await Promise.all(
        (data || []).map(async (message) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', message.from_user_id)
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
    }
  };

  const fetchDashboardSettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('dashboard_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setDashboardSettings({
          show_stats: data.show_stats,
          show_recent_activity: data.show_recent_activity,
          show_active_jobs: data.show_active_jobs,
          show_notifications: data.show_notifications,
          show_messages: data.show_messages,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard settings:', error);
    }
  };

  const updateDashboardSettings = async (settings: Partial<DashboardSettings>) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('dashboard_settings')
        .upsert({
          user_id: user.id,
          ...dashboardSettings,
          ...settings,
        });

      if (error) throw error;
      
      setDashboardSettings(prev => ({ ...prev, ...settings }));
      toast({
        title: 'Settings Updated',
        description: 'Dashboard preferences saved successfully',
      });
    } catch (error) {
      console.error('Error updating dashboard settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update dashboard settings',
        variant: 'destructive',
      });
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
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

  const stats = [
    {
      title: "Uncoded Receipts",
      value: "12",
      icon: Clock,
      variant: "warning" as const,
    },
    {
      title: "Total Receipts",
      value: "247",
      icon: Receipt,
      variant: "default" as const,
    },
    {
      title: "Completed Jobs",
      value: "8",
      icon: CheckCircle,
      variant: "secondary" as const,
    },
    {
      title: "Pending Invoices",
      value: "$12,450",
      icon: DollarSign,
      variant: "destructive" as const,
    },
  ];

  return (
    <div className="p-6">
      {settings.dashboardBanner && (
        <div className="mb-6 relative rounded-lg overflow-hidden">
          <img 
            src={settings.dashboardBanner} 
            alt="Dashboard Banner" 
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-4xl font-bold mb-2">
                Welcome back, {profile?.display_name || profile?.first_name || 'User'}! 👋
              </h1>
              <p className="text-lg opacity-90">
                Here's what's happening with your projects today
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-6 flex items-center justify-between">
        {!settings.dashboardBanner && (
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {profile?.display_name || profile?.first_name || 'User'}! 👋
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your projects today
            </p>
          </div>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Customize
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dashboard Settings</DialogTitle>
              <DialogDescription>
                Choose what sections you want to see on your dashboard
              </DialogDescription>
            </DialogHeader>
            <DashboardCustomizer 
              onSettingsChange={updateDashboardSettings}
              currentSettings={dashboardSettings}
            />
          </DialogContent>
        </Dialog>
      </div>

      {dashboardSettings.show_stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <Badge variant={stat.variant} className="mt-2">
                  {stat.variant === "warning" && "Needs Attention"}
                  {stat.variant === "secondary" && "Up to Date"}
                  {stat.variant === "destructive" && "Overdue"}
                  {stat.variant === "default" && "Active"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Notifications and Messages Row */}
      {(dashboardSettings.show_notifications || dashboardSettings.show_messages) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {dashboardSettings.show_notifications && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                  {notifications.filter(n => !n.read).length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {notifications.filter(n => !n.read).length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {notifications.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No notifications
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 rounded-lg border ${
                          !notification.read ? 'bg-accent' : 'bg-background'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{notification.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(notification.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {!notification.read && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markNotificationAsRead(notification.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {dashboardSettings.show_messages && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Messages
                  {messages.filter(m => !m.read).length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {messages.filter(m => !m.read).length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No messages
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`p-3 rounded-lg border ${
                          !message.read ? 'bg-accent' : 'bg-background'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{message.subject}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              From: {message.from_profile?.display_name}
                            </p>
                            <p className="text-sm mt-2 line-clamp-2">
                              {message.content}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(message.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {!message.read && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markMessageAsRead(message.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {(dashboardSettings.show_recent_activity || dashboardSettings.show_active_jobs) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {dashboardSettings.show_recent_activity && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { action: "Receipt uploaded", job: "Office Renovation", time: "2 hours ago" },
                    { action: "Invoice paid", vendor: "ABC Supplies", time: "4 hours ago" },
                    { action: "Cost code assigned", job: "Warehouse Project", time: "1 day ago" },
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{activity.action}</p>
                        <p className="text-sm text-muted-foreground">
                          {activity.job || activity.vendor}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {dashboardSettings.show_active_jobs && (
            <Card>
              <CardHeader>
                <CardTitle>Active Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "Office Renovation", receipts: 8, budget: "$25,000" },
                    { name: "Warehouse Project", receipts: 15, budget: "$50,000" },
                    { name: "Retail Buildout", receipts: 4, budget: "$15,000" },
                  ].map((job, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{job.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {job.receipts} receipts • {job.budget} budget
                        </p>
                      </div>
                      <Badge variant="outline">Active</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
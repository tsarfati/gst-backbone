import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import DashboardCustomizer from '@/components/DashboardCustomizer';
import { Receipt, Clock, CheckCircle, DollarSign, Settings, Bell, MessageSquare, X, FileText, AlertTriangle } from "lucide-react";
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
  show_invoices: boolean;
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
    show_invoices: true,
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
          show_invoices: data.show_invoices ?? true,
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
      value: "0",
      icon: Clock,
      variant: "warning" as const,
    },
    {
      title: "Total Receipts",
      value: "0",
      icon: Receipt,
      variant: "default" as const,
    },
    {
      title: "Completed Jobs",
      value: "0",
      icon: CheckCircle,
      variant: "secondary" as const,
    },
    {
      title: "Pending Invoices",
      value: "$0",
      icon: DollarSign,
      variant: "destructive" as const,
    },
  ];

  return (
    <div className="p-md-6 min-h-screen bg-background">
      {settings.dashboardBanner && (
        <div className="mb-md-6 relative rounded-md-large overflow-hidden animate-fade-in">
          <img 
            src={settings.dashboardBanner} 
            alt="Dashboard Banner" 
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/30 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="md-display-small mb-md-2">
                Welcome back, {profile?.display_name || profile?.first_name || 'User'}! 👋
              </h1>
              <p className="md-body-large opacity-90">
                Here's what's happening with your projects today
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-md-6 flex items-center justify-between">
        {!settings.dashboardBanner && (
          <div className="animate-fade-in">
            <h1 className="md-headline-large text-foreground mb-md-2">
              Welcome back, {profile?.display_name || profile?.first_name || 'User'}! 👋
            </h1>
            <p className="md-body-large text-muted-foreground">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md-6 mb-md-8">
          {stats.map((stat, index) => (
            <Card 
              key={stat.title} 
              elevation={2}
              className="animate-fade-in hover:scale-105 transition-transform duration-200"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-md-2">
                <CardTitle className="md-title-small">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="md-display-small font-bold text-primary">{stat.value}</div>
                <Badge variant={stat.variant} className="mt-md-2">
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

      {/* Invoice Management Section */}
      {dashboardSettings.show_invoices && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Important Invoices */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Overdue Invoices</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                      <div>
                        <p className="font-medium text-sm">INV-2024-001</p>
                        <p className="text-xs text-muted-foreground">ABC Construction</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive" className="mb-1">30 days</Badge>
                        <p className="text-sm font-semibold">$12,500</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                      <div>
                        <p className="font-medium text-sm">INV-2024-003</p>
                        <p className="text-xs text-muted-foreground">XYZ Materials</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive" className="mb-1">15 days</Badge>
                        <p className="text-sm font-semibold">$8,750</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Due Soon */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Due This Week</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
                      <div>
                        <p className="font-medium text-sm">INV-2024-005</p>
                        <p className="text-xs text-muted-foreground">DEF Supplies</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="mb-1">3 days</Badge>
                        <p className="text-sm font-semibold">$5,200</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
                      <div>
                        <p className="font-medium text-sm">INV-2024-007</p>
                        <p className="text-xs text-muted-foreground">GHI Equipment</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="mb-1">5 days</Badge>
                        <p className="text-sm font-semibold">$15,800</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Paid */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Recently Paid</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                      <div>
                        <p className="font-medium text-sm">INV-2024-002</p>
                        <p className="text-xs text-muted-foreground">JKL Contractors</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="mb-1">Paid</Badge>
                        <p className="text-sm font-semibold">$9,400</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                      <div>
                        <p className="font-medium text-sm">INV-2024-004</p>
                        <p className="text-xs text-muted-foreground">MNO Services</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="mb-1">Paid</Badge>
                        <p className="text-sm font-semibold">$3,200</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" size="sm">
                  View All Invoices
                </Button>
                <Button variant="outline" size="sm">
                  Create Invoice
                </Button>
                <Button variant="outline" size="sm">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Follow Up Overdue
                </Button>
              </div>
            </CardContent>
          </Card>
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
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No recent activity</p>
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
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No active jobs</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
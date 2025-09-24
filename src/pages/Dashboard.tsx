import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import DashboardCustomizer from '@/components/DashboardCustomizer';
import { Receipt, Clock, CheckCircle, DollarSign, Settings, Bell, MessageSquare, X, FileText, AlertTriangle, Users, TrendingUp, BarChart3 } from "lucide-react";
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
  show_bills: boolean;
  // Financial Management
  show_bills_overview: boolean;
  show_payment_status: boolean;
  show_invoice_summary: boolean;
  show_budget_tracking: boolean;
  // Time Tracking
  show_punch_clock_status: boolean;
  show_timesheet_approval: boolean;
  show_overtime_alerts: boolean;
  show_employee_attendance: boolean;
  // Project Management
  show_project_progress: boolean;
  show_task_deadlines: boolean;
  show_resource_allocation: boolean;
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({
    show_stats: true,
    show_recent_activity: true,
    show_active_jobs: true,
    show_notifications: true,
    show_messages: true,
    show_bills: true,
    // Financial Management
    show_bills_overview: false,
    show_payment_status: false,
    show_invoice_summary: false,
    show_budget_tracking: false,
    // Time Tracking
    show_punch_clock_status: false,
    show_timesheet_approval: false,
    show_overtime_alerts: false,
    show_employee_attendance: false,
    // Project Management
    show_project_progress: false,
    show_task_deadlines: false,
    show_resource_allocation: false,
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
          show_bills: data.show_invoices ?? true,
          // Financial Management
          show_bills_overview: data.show_bills_overview ?? false,
          show_payment_status: data.show_payment_status ?? false,
          show_invoice_summary: data.show_invoice_summary ?? false,
          show_budget_tracking: data.show_budget_tracking ?? false,
          // Time Tracking
          show_punch_clock_status: data.show_punch_clock_status ?? false,
          show_timesheet_approval: data.show_timesheet_approval ?? false,
          show_overtime_alerts: data.show_overtime_alerts ?? false,
          show_employee_attendance: data.show_employee_attendance ?? false,
          // Project Management
          show_project_progress: data.show_project_progress ?? false,
          show_task_deadlines: data.show_task_deadlines ?? false,
          show_resource_allocation: data.show_resource_allocation ?? false,
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
      href: "/uncoded",
    },
    {
      title: "Total Receipts",
      value: "0",
      icon: Receipt,
      variant: "default" as const,
      href: "/receipts",
    },
    {
      title: "Completed Jobs",
      value: "0",
      icon: CheckCircle,
      variant: "secondary" as const,
      href: "/jobs",
    },
    {
      title: "Pending Bills",
      value: "$0",
      icon: DollarSign,
      variant: "destructive" as const,
      href: "/bills",
    },
  ];

  const handleStatClick = (href: string) => {
    navigate(href);
  };

  return (
    <div className="p-6">
      {/* Welcome text always appears above banner when banner exists */}
      {settings.dashboardBanner && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {profile?.display_name || profile?.first_name || 'User'}! 👋
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your projects today
          </p>
        </div>
      )}
      
      {settings.dashboardBanner && (
        <div className="mb-6 relative rounded-lg overflow-hidden">
          <img 
            src={settings.dashboardBanner} 
            alt="Dashboard Banner" 
            className="w-full h-48 object-cover"
          />
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
            <Card 
              key={stat.title} 
              className="hover-stat animate-fade-in"
              onClick={() => handleStatClick(stat.href)}
            >
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
                        className={`p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${
                          !message.read ? 'bg-accent' : 'bg-background'
                        }`}
                        onClick={() => {
                          markMessageAsRead(message.id);
                          navigate(`/messages?thread=${message.id}`);
                        }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                markMessageAsRead(message.id);
                              }}
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

      {/* Bill Management Section */}
      {dashboardSettings.show_bills && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Bill Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">No bill data to display</p>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" size="sm">
                  View All Bills
                </Button>
                <Button variant="outline" size="sm">
                  Create Bill
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

      {/* Financial Management Sections */}
      {dashboardSettings.show_bills_overview && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bills Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-warning/10 p-4 rounded-lg">
                <h4 className="font-semibold text-warning">Pending Approval</h4>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Bills awaiting review</p>
              </div>
              <div className="bg-destructive/10 p-4 rounded-lg">
                <h4 className="font-semibold text-destructive">Overdue</h4>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Past due bills</p>
              </div>
              <div className="bg-success/10 p-4 rounded-lg">
                <h4 className="font-semibold text-success">Paid This Month</h4>
                <p className="text-2xl font-bold">$0</p>
                <p className="text-sm text-muted-foreground">Total processed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_payment_status && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-accent rounded-lg">
                <span>Total Outstanding</span>
                <span className="font-bold text-lg">$0.00</span>
              </div>
              <div className="flex justify-between items-center p-3 border rounded-lg">
                <span>Scheduled Payments</span>
                <span className="font-medium">0</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_invoice_summary && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoice Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-primary">0</p>
                <p className="text-sm text-muted-foreground">Invoices Generated</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-success">$0</p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_budget_tracking && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Budget Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Project Budget Utilization</span>
                  <span>0%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '0%' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Tracking Sections */}
      {dashboardSettings.show_punch_clock_status && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Punch Clock Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-success/10 p-4 rounded-lg">
                <h4 className="font-semibold text-success">Currently Punched In</h4>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Active employees</p>
              </div>
              <div className="bg-primary/10 p-4 rounded-lg">
                <h4 className="font-semibold text-primary">Total Hours Today</h4>
                <p className="text-2xl font-bold">0.0</p>
                <p className="text-sm text-muted-foreground">Company-wide</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => navigate("/punch-clock-app")} variant="outline" className="flex-1">
                <Clock className="h-4 w-4 mr-2" />
                Mobile Punch Clock
              </Button>
              <Button onClick={() => navigate("/punch-clock")} className="flex-1">
                <Clock className="h-4 w-4 mr-2" />
                Desktop Punch Clock
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_timesheet_approval && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Timesheet Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-2xl font-bold text-warning">0</p>
              <p className="text-sm text-muted-foreground">Timesheets pending approval</p>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_overtime_alerts && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Overtime Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Employees over 40hrs this week</span>
                <Badge variant="warning">0</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Overtime hours this week</span>
                <span className="font-medium">0.0</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_employee_attendance && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-success">0</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
              <div>
                <p className="text-lg font-bold text-warning">0</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">0</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Management Sections */}
      {dashboardSettings.show_project_progress && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Project Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Active Projects</span>
                <span className="font-bold">0</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Completion</span>
                  <span>0%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-success h-2 rounded-full" style={{ width: '0%' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_task_deadlines && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Task Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-destructive/10 rounded-lg">
                <span>Overdue Tasks</span>
                <Badge variant="destructive">0</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-warning/10 rounded-lg">
                <span>Due This Week</span>
                <Badge variant="warning">0</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_resource_allocation && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Resource Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <p className="text-lg font-bold">0</p>
                <p className="text-xs text-muted-foreground">Team Members</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <p className="text-lg font-bold">0%</p>
                <p className="text-xs text-muted-foreground">Utilization</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
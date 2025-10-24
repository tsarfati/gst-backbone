import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bell, Mail, Eye, Edit, MessageSquare, History, Send, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import CompanySmsSettings from "@/components/CompanySmsSettings";

interface NotificationSettings {
  id?: string;
  user_id: string;
  company_id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  overdue_bills: boolean;
  overdue_bills_interval?: string;
  bills_paid: boolean;
  vendor_invitations: boolean;
  job_assignments: boolean;
  receipt_uploaded: boolean;
  bill_approval_request?: boolean;
  bill_coding_request?: boolean;
  credit_card_coding_request?: boolean;
  financial_overview_enabled?: boolean;
  financial_overview_interval?: string;
}

interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  description: string;
  subject: string;
}

interface EmailHistory {
  id: string;
  recipient_email: string;
  subject: string;
  email_type: string;
  status: string;
  sent_at: string;
  error_message?: string;
}

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [settings, setSettings] = useState<NotificationSettings>({
    user_id: user?.id || "",
    company_id: currentCompany?.id || "",
    email_enabled: true,
    in_app_enabled: true,
    overdue_bills: true,
    bills_paid: true,
    vendor_invitations: true,
    job_assignments: true,
    receipt_uploaded: true,
  });
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailHistory, setEmailHistory] = useState<EmailHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (user && currentCompany) {
      loadNotificationSettings();
      loadEmailTemplates();
      loadEmailHistory();
    }
  }, [user, currentCompany]);

  const loadNotificationSettings = async () => {
    if (!user || !currentCompany) return;

    try {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("company_id", currentCompany.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings({
          ...data,
          overdue_bills: data.overdue_invoices,
          bills_paid: data.invoices_paid,
        });
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
      toast({
        title: "Error",
        description: "Failed to load notification settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEmailTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, key, name, description, subject")
        .order("name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error loading email templates:", error);
    }
  };

  const loadEmailHistory = async () => {
    if (!currentCompany) return;

    try {
      const { data, error } = await supabase
        .from("email_history")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setEmailHistory(data || []);
    } catch (error) {
      console.error("Error loading email history:", error);
    }
  };

  const saveSettings = async () => {
    if (!user || !currentCompany) return;

    try {
      const dbSettings = {
        ...settings,
        overdue_invoices: settings.overdue_bills,
        invoices_paid: settings.bills_paid,
      };
      
      const { error } = await supabase
        .from("notification_settings")
        .upsert(dbSettings, { onConflict: "user_id,company_id" });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your notification settings have been updated.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save notification settings",
        variant: "destructive",
      });
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail || !currentCompany) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setSendingTest(true);

    try {
      const { error } = await supabase.functions.invoke("send-test-email", {
        body: {
          email: testEmail,
          companyId: currentCompany.id,
          companyName: currentCompany.name,
        },
      });

      if (error) throw error;

      toast({
        title: "Test email sent!",
        description: `Test email sent successfully to ${testEmail}`,
      });

      setTestEmail("");
      
      // Refresh email history
      await loadEmailHistory();
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast({
        title: "Failed to send test email",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEmailTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      overdue_bills: "Overdue Bills",
      test: "Test Email",
      notification: "Notification",
      bill_payment: "Bill Payment",
      receipt_uploaded: "Receipt Upload",
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications & Email Settings</h1>
          <p className="text-muted-foreground">
            Configure notification preferences, email templates, and messaging settings
          </p>
        </div>
      </div>

      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger 
            value="notifications" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
          >
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger 
            value="email-templates" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger 
            value="email-history" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
          >
            <History className="h-4 w-4" />
            Email History
          </TabsTrigger>
          <TabsTrigger 
            value="text-messaging" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Text Messaging
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Test Email Section */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="text-sm font-medium mb-3">Test Email Configuration</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Send a test email to verify your email server is configured correctly
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    disabled={sendingTest}
                  />
                  <Button
                    onClick={sendTestEmail}
                    disabled={sendingTest || !testEmail}
                  >
                    {sendingTest ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Test
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* General Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">General</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-enabled">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    id="email-enabled"
                    checked={settings.email_enabled}
                    onCheckedChange={(checked) => updateSetting("email_enabled", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="in-app-enabled">In-App Notifications</Label>
                    <p className="text-sm text-muted-foreground">Show notifications in the application</p>
                  </div>
                  <Switch
                    id="in-app-enabled"
                    checked={settings.in_app_enabled}
                    onCheckedChange={(checked) => updateSetting("in_app_enabled", checked)}
                  />
                </div>
              </div>

              <Separator />

              {/* Specific Notifications */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Notification Types</h3>
                <div className="space-y-4">
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="overdue-bills">Overdue Bills</Label>
                        <p className="text-sm text-muted-foreground">Get notified about overdue bills</p>
                      </div>
                      <Switch
                        id="overdue-bills"
                        checked={settings.overdue_bills}
                        onCheckedChange={(checked) => updateSetting("overdue_bills", checked)}
                      />
                    </div>
                    {settings.overdue_bills && (
                      <div className="ml-0 pt-2">
                        <Label htmlFor="overdue-bills-interval" className="text-sm text-muted-foreground">
                          Notification Frequency
                        </Label>
                        <Select
                          value={settings.overdue_bills_interval || 'daily'}
                          onValueChange={(value) => setSettings(prev => ({ ...prev, overdue_bills_interval: value }))}
                        >
                          <SelectTrigger id="overdue-bills-interval" className="w-full mt-2">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="bills-paid">Bill Payments</Label>
                      <p className="text-sm text-muted-foreground">Get notified when bills are paid</p>
                    </div>
                    <Switch
                      id="bills-paid"
                      checked={settings.bills_paid}
                      onCheckedChange={(checked) => updateSetting("bills_paid", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="vendor-invitations">Vendor Invitations</Label>
                      <p className="text-sm text-muted-foreground">Get notified about vendor invitations</p>
                    </div>
                    <Switch
                      id="vendor-invitations"
                      checked={settings.vendor_invitations}
                      onCheckedChange={(checked) => updateSetting("vendor_invitations", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="job-assignments">Job Assignments</Label>
                      <p className="text-sm text-muted-foreground">Get notified about new job assignments</p>
                    </div>
                    <Switch
                      id="job-assignments"
                      checked={settings.job_assignments}
                      onCheckedChange={(checked) => updateSetting("job_assignments", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="receipt-uploaded">Receipt Uploads</Label>
                      <p className="text-sm text-muted-foreground">Get notified when receipts are uploaded</p>
                    </div>
                    <Switch
                      id="receipt-uploaded"
                      checked={settings.receipt_uploaded}
                      onCheckedChange={(checked) => updateSetting("receipt_uploaded", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="bill-approval">Bill Approval Requests</Label>
                      <p className="text-sm text-muted-foreground">Get notified when asked to approve or cost code a bill</p>
                    </div>
                    <Switch
                      id="bill-approval"
                      checked={settings.bill_approval_request || false}
                      onCheckedChange={(checked) => updateSetting("bill_approval_request" as any, checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="credit-card-coding">Credit Card Coding Requests</Label>
                      <p className="text-sm text-muted-foreground">Get notified when requested to help code credit card transactions</p>
                    </div>
                    <Switch
                      id="credit-card-coding"
                      checked={settings.credit_card_coding_request || false}
                      onCheckedChange={(checked) => updateSetting("credit_card_coding_request" as any, checked)}
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Financial Reports */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Financial Reports</h3>
                <div className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="financial-overview">Financial Overview Report</Label>
                      <p className="text-sm text-muted-foreground">
                        Automated report including approved bills awaiting payment, overdue bills, and outstanding customer invoices
                      </p>
                    </div>
                    <Switch
                      id="financial-overview"
                      checked={settings.financial_overview_enabled || false}
                      onCheckedChange={(checked) => updateSetting("financial_overview_enabled" as any, checked)}
                    />
                  </div>
                  {settings.financial_overview_enabled && (
                    <div className="ml-0 pt-2">
                      <Label htmlFor="financial-overview-interval" className="text-sm text-muted-foreground">
                        Report Frequency
                      </Label>
                      <Select
                        value={settings.financial_overview_interval || 'weekly'}
                        onValueChange={(value) => setSettings(prev => ({ ...prev, financial_overview_interval: value }))}
                      >
                        <SelectTrigger id="financial-overview-interval" className="w-full mt-2">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSettings}>
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-templates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Subject: {template.subject}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/settings/email-templates/${template.id}/preview`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/settings/email-templates/${template.id}/edit`)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Email History
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                View all emails sent from your account
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {emailHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No emails sent yet</p>
                  </div>
                ) : (
                  emailHistory.map((email) => (
                    <div key={email.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{email.subject}</h4>
                          {getStatusBadge(email.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="truncate">To: {email.recipient_email}</span>
                          <Badge variant="outline" className="text-xs">
                            {getEmailTypeLabel(email.email_type)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(email.sent_at).toLocaleString()}
                        </p>
                        {email.error_message && (
                          <p className="text-xs text-destructive mt-1">
                            Error: {email.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text-messaging">
          <CompanySmsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

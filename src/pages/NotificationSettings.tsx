import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Bell, Mail, Eye, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationSettings {
  id?: string;
  user_id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  overdue_invoices: boolean;
  invoices_paid: boolean;
  vendor_invitations: boolean;
  job_assignments: boolean;
  receipt_uploaded: boolean;
}

interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  description: string;
  subject: string;
}

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({
    user_id: user?.id || "",
    email_enabled: true,
    in_app_enabled: true,
    overdue_invoices: true,
    invoices_paid: true,
    vendor_invitations: true,
    job_assignments: true,
    receipt_uploaded: true,
  });
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotificationSettings();
      loadEmailTemplates();
    }
  }, [user]);

  const loadNotificationSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings(data);
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

  const saveSettings = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notification_settings")
        .upsert(settings, { onConflict: "user_id" });

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

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
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
          <h1 className="text-2xl font-bold text-foreground">Notifications & Email Templates</h1>
          <p className="text-muted-foreground">
            Configure your notification preferences and manage email templates
          </p>
        </div>
      </div>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="overdue-invoices">Overdue Invoices</Label>
                  <p className="text-sm text-muted-foreground">Get notified about overdue invoices</p>
                </div>
                <Switch
                  id="overdue-invoices"
                  checked={settings.overdue_invoices}
                  onCheckedChange={(checked) => updateSetting("overdue_invoices", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="invoices-paid">Invoice Payments</Label>
                  <p className="text-sm text-muted-foreground">Get notified when invoices are paid</p>
                </div>
                <Switch
                  id="invoices-paid"
                  checked={settings.invoices_paid}
                  onCheckedChange={(checked) => updateSetting("invoices_paid", checked)}
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
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveSettings}>
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Templates */}
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
    </div>
  );
}
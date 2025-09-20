import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface EmailTemplate {
  id?: string;
  key: string;
  name: string;
  description: string;
  subject: string;
  html_content: string;
  editor_type: "richtext" | "html";
}

export default function EmailTemplateEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [template, setTemplate] = useState<EmailTemplate>({
    key: "",
    name: "",
    description: "",
    subject: "",
    html_content: "",
    editor_type: "html",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && id !== "new") {
      loadTemplate();
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setTemplate(data);
    } catch (error) {
      console.error("Error loading template:", error);
      toast({
        title: "Error",
        description: "Failed to load email template",
        variant: "destructive",
      });
      navigate("/settings/notifications");
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const templateData = {
        ...template,
        created_by: user.id,
      };

      if (id && id !== "new") {
        const { error } = await supabase
          .from("email_templates")
          .update(templateData)
          .eq("id", id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert(templateData);
        
        if (error) throw error;
      }

      toast({
        title: "Template saved",
        description: "Email template has been saved successfully.",
      });
      
      navigate("/settings/notifications");
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save email template",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = (field: keyof EmailTemplate, value: string) => {
    setTemplate(prev => ({ ...prev, [field]: value }));
  };

  const getPreviewContent = () => {
    // Replace template variables with sample data for preview
    return template.html_content
      .replace(/{{customer_name}}/g, "John Doe")
      .replace(/{{company_name}}/g, "Your Company")
      .replace(/{{invoice_number}}/g, "INV-001")
      .replace(/{{amount}}/g, "$1,250.00")
      .replace(/{{due_date}}/g, "2024-01-15")
      .replace(/{{vendor_name}}/g, "ABC Supplies")
      .replace(/{{invitation_link}}/g, "#")
      .replace(/{{job_name}}/g, "Office Renovation")
      .replace(/{{assignee_name}}/g, "Jane Smith")
      .replace(/{{start_date}}/g, "2024-02-01")
      .replace(/{{uploader_name}}/g, "Mike Johnson")
      .replace(/{{filename}}/g, "receipt-001.pdf");
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/settings/notifications")}>
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/settings/notifications")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {id === "new" ? "Create Email Template" : "Edit Email Template"}
            </h1>
            <p className="text-muted-foreground">
              {id === "new" ? "Create a new email template" : "Modify the email template"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/settings/email-templates/${id}/preview`)}
            disabled={!template.html_content}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={saveTemplate} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Template Editor */}
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={template.name}
                onChange={(e) => updateTemplate("name", e.target.value)}
                placeholder="Enter template name"
              />
            </div>

            <div>
              <Label htmlFor="key">Template Key</Label>
              <Input
                id="key"
                value={template.key}
                onChange={(e) => updateTemplate("key", e.target.value)}
                placeholder="e.g., overdue_invoice"
                disabled={id !== "new"}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={template.description}
                onChange={(e) => updateTemplate("description", e.target.value)}
                placeholder="Describe when this template is used"
              />
            </div>

            <div>
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={template.subject}
                onChange={(e) => updateTemplate("subject", e.target.value)}
                placeholder="Enter email subject (use {{variables}} for dynamic content)"
              />
            </div>

            <div>
              <Label htmlFor="editor-type">Editor Type</Label>
              <Select
                value={template.editor_type}
                onValueChange={(value: "richtext" | "html") => updateTemplate("editor_type", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="html">HTML Editor</SelectItem>
                  <SelectItem value="richtext">Rich Text Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="content">Email Content</Label>
              <Textarea
                id="content"
                value={template.html_content}
                onChange={(e) => updateTemplate("html_content", e.target.value)}
                placeholder="Enter the email content using HTML or rich text"
                className="min-h-[300px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Available variables: {"{{customer_name}}, {{company_name}}, {{invoice_number}}, {{amount}}, {{due_date}}, {{vendor_name}}, {{job_name}}, {{assignee_name}}, {{start_date}}, {{uploader_name}}, {{filename}}"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="rendered">
              <TabsList>
                <TabsTrigger value="rendered">Rendered</TabsTrigger>
                <TabsTrigger value="html">HTML Source</TabsTrigger>
              </TabsList>
              <TabsContent value="rendered" className="space-y-4">
                <div className="border rounded-lg p-4 bg-white">
                  <div className="border-b pb-2 mb-4">
                    <p className="text-sm text-muted-foreground">Subject:</p>
                    <p className="font-medium">
                      {template.subject
                        .replace(/\{\{customer_name\}\}/g, "John Doe")
                        .replace(/\{\{company_name\}\}/g, "Your Company")
                        .replace(/\{\{invoice_number\}\}/g, "INV-001")
                        .replace(/\{\{amount\}\}/g, "$1,250.00")
                        .replace(/\{\{due_date\}\}/g, "2024-01-15")
                        .replace(/\{\{vendor_name\}\}/g, "ABC Supplies")
                        .replace(/\{\{job_name\}\}/g, "Office Renovation")
                        .replace(/\{\{assignee_name\}\}/g, "Jane Smith")
                        .replace(/\{\{start_date\}\}/g, "2024-02-01")
                        .replace(/\{\{uploader_name\}\}/g, "Mike Johnson")
                        .replace(/\{\{filename\}\}/g, "receipt-001.pdf")}
                    </p>
                  </div>
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: getPreviewContent() }}
                  />
                </div>
              </TabsContent>
              <TabsContent value="html">
                <div className="border rounded-lg p-4 bg-gray-50">
                  <pre className="text-xs overflow-x-auto">
                    <code>{getPreviewContent()}</code>
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
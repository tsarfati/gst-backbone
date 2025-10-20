import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  description: string;
  subject: string;
  html_content: string;
  editor_type: "richtext" | "html";
}

export default function EmailTemplatePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, [id]);

  const loadTemplate = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setTemplate(data);
    } catch (error: any) {
      console.error('Error loading template:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email template',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading preview...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto p-6">
        <p>Template not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate('/settings/notifications')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Email Templates
          </Button>
          <h1 className="text-3xl font-bold">{template.name} - Preview</h1>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/settings/email-templates/${id}/edit`)}
        >
          Edit Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subject: {template.subject}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 bg-background">
            <div 
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: template.html_content }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

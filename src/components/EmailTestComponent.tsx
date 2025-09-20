import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail } from "lucide-react";

export default function EmailTestComponent() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("Test Email from Construction App");
  const [message, setMessage] = useState("This is a test email sent via Resend!");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const sendTestEmail = async () => {
    if (!email || !subject || !message) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Test Email from Construction App</h2>
              <p style="color: #666; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">
                This email was sent from your Construction Management Application
              </p>
            </div>
          `,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Email sent successfully!",
        description: `Test email sent to ${email}`,
      });
      
      // Reset form
      setEmail("");
      setMessage("This is a test email sent via Resend!");
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: "Failed to send email",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Test Resend Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Recipient Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="test@example.com"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your message here..."
            rows={3}
          />
        </div>
        
        <Button 
          onClick={sendTestEmail} 
          disabled={sending}
          className="w-full"
        >
          {sending ? "Sending..." : "Send Test Email"}
        </Button>
      </CardContent>
    </Card>
  );
}
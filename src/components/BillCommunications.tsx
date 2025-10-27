import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Users, 
  Send, 
  MessageSquare, 
  Calendar,
  User
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
}

interface BillCommunicationsProps {
  billId: string;
  vendorId: string;
}

export default function BillCommunications({ billId, vendorId }: BillCommunicationsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [intercompanyMessages, setIntercompanyMessages] = useState<Message[]>([]);
  const [vendorMessages, setVendorMessages] = useState<Message[]>([]);
  const [newIntercompanyMessage, setNewIntercompanyMessage] = useState("");
  const [newVendorMessage, setNewVendorMessage] = useState("");
  const [loadingIntercompany, setLoadingIntercompany] = useState(false);
  const [loadingVendor, setLoadingVendor] = useState(false);

  useEffect(() => {
    loadMessages();
  }, [billId]);

  const loadMessages = async () => {
    if (!billId) return;
    
    try {
      // Load intercompany messages from bill_communications table
      const { data: commData, error: commError } = await supabase
        .from('bill_communications')
        .select(`
          *,
          profiles:user_id (
            display_name,
            first_name,
            last_name
          )
        `)
        .eq('bill_id', billId)
        .order('created_at', { ascending: true });

      if (commError) {
        console.error('Error loading bill communications:', commError);
      } else {
        const formatted = (commData || []).map((msg: any) => ({
          id: msg.id,
          content: msg.message,
          sender: msg.profiles?.display_name || `${msg.profiles?.first_name || ''} ${msg.profiles?.last_name || ''}`.trim() || 'Unknown User',
          timestamp: msg.created_at,
        }));
        setIntercompanyMessages(formatted);
      }

      // Vendor messages - placeholder for future implementation
      setVendorMessages([]);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendIntercompanyMessage = async () => {
    if (!newIntercompanyMessage.trim() || !user || !currentCompany) return;

    try {
      setLoadingIntercompany(true);
      
      // Insert into bill_communications table
      const { error } = await supabase
        .from('bill_communications')
        .insert({
          bill_id: billId,
          company_id: currentCompany.id,
          user_id: user.id,
          message: newIntercompanyMessage.trim(),
        });

      if (error) throw error;

      toast({
        title: "Message sent",
        description: "Your message has been posted to the team",
      });

      setNewIntercompanyMessage("");
      loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoadingIntercompany(false);
    }
  };

  const sendVendorMessage = async () => {
    if (!newVendorMessage.trim()) return;

    try {
      setLoadingVendor(true);
      
      // In a real implementation, this would integrate with email or vendor portal
      toast({
        title: "Feature Coming Soon",
        description: "Vendor messaging will be available in the next update",
      });

      setNewVendorMessage("");
    } catch (error) {
      console.error('Error sending vendor message:', error);
      toast({
        title: "Error",
        description: "Failed to send message to vendor",
        variant: "destructive",
      });
    } finally {
      setLoadingVendor(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Communications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="intercompany" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="intercompany" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Intercompany
              {intercompanyMessages.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {intercompanyMessages.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="vendor" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Vendor
              {vendorMessages.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {vendorMessages.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="intercompany" className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Team Discussion</h4>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {intercompanyMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No team discussions yet. Start the conversation below.
                  </p>
                ) : (
                  intercompanyMessages.map((message) => (
                    <div key={message.id} className="bg-muted/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-3 w-3" />
                        <span className="text-sm font-medium">
                          {message.sender}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(message.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <Textarea
                  placeholder="Type your message to the team..."
                  value={newIntercompanyMessage}
                  onChange={(e) => setNewIntercompanyMessage(e.target.value)}
                  rows={3}
                />
                <Button 
                  onClick={sendIntercompanyMessage}
                  disabled={loadingIntercompany || !newIntercompanyMessage.trim()}
                  size="sm"
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send to Team
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vendor" className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Vendor Communication</h4>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {vendorMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No vendor communications yet.
                  </p>
                ) : (
                  vendorMessages.map((message) => (
                    <div key={message.id} className="bg-muted/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-3 w-3" />
                        <span className="text-sm font-medium">Vendor</span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(message.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <Textarea
                  placeholder="Type your message to the vendor..."
                  value={newVendorMessage}
                  onChange={(e) => setNewVendorMessage(e.target.value)}
                  rows={3}
                />
                <Button 
                  onClick={sendVendorMessage}
                  disabled={loadingVendor || !newVendorMessage.trim()}
                  size="sm"
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send to Vendor
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

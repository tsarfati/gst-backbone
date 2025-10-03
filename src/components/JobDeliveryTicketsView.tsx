import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DeliveryTicket {
  id: string;
  vendor_name: string;
  ticket_number?: string;
  delivery_date: string;
  description?: string;
  created_at: string;
}

export default function JobDeliveryTicketsView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, [id]);

  const loadTickets = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('delivery_tickets')
        .select('*')
        .eq('job_id', id)
        .order('delivery_date', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading delivery tickets:', error);
      toast({
        title: "Error",
        description: "Failed to load delivery tickets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading delivery tickets...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Delivery Tickets</h3>
        <Button onClick={() => navigate(`/jobs/${id}/delivery-tickets`)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No delivery tickets found</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate(`/jobs/${id}/delivery-tickets`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{ticket.vendor_name}</span>
                      {ticket.ticket_number && (
                        <Badge variant="outline">#{ticket.ticket_number}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(ticket.delivery_date), 'MMM dd, yyyy')}
                    </div>
                    {ticket.description && (
                      <p className="text-sm mt-1">{ticket.description}</p>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate(`/jobs/${id}/delivery-tickets`)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

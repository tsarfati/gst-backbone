import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Package, Building2, FileText, Camera, Edit, Save, X, Loader2, User, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DeliveryTicket {
  id: string;
  job_id: string;
  ticket_number?: string;
  delivery_date: string;
  vendor_name: string;
  description?: string;
  photo_url?: string;
  delivery_slip_photo_url?: string;
  material_photo_url?: string;
  notes?: string;
  created_at: string;
  created_by: string;
  received_by?: string;
}

interface AuditEntry {
  id: string;
  change_type: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  reason?: string;
  created_at: string;
  changed_by: string;
  user_profile?: {
    display_name: string;
  };
}

interface DeliveryTicketDetailViewProps {
  ticket: DeliveryTicket | null;
  isOpen: boolean;
  onClose: () => void;
  onTicketUpdated: () => void;
}

export default function DeliveryTicketDetailView({ 
  ticket, 
  isOpen, 
  onClose, 
  onTicketUpdated 
}: DeliveryTicketDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [receivedByProfile, setReceivedByProfile] = useState<{display_name: string} | null>(null);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [editData, setEditData] = useState({
    ticket_number: '',
    delivery_date: '',
    vendor_name: '',
    description: '',
    notes: ''
  });

  const isProjectManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  const startEditing = () => {
    if (!ticket) return;
    setEditData({
      ticket_number: ticket.ticket_number || '',
      delivery_date: ticket.delivery_date,
      vendor_name: ticket.vendor_name,
      description: ticket.description || '',
      notes: ticket.notes || ''
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditData({
      ticket_number: '',
      delivery_date: '',
      vendor_name: '',
      description: '',
      notes: ''
    });
  };

  const saveChanges = async () => {
    if (!ticket || !user) return;

    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from('delivery_tickets')
        .update({
          ticket_number: editData.ticket_number.trim() || null,
          delivery_date: editData.delivery_date,
          vendor_name: editData.vendor_name.trim(),
          description: editData.description.trim() || null,
          notes: editData.notes.trim() || null,
        })
        .eq('id', ticket.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Delivery ticket updated successfully.',
      });

      setIsEditing(false);
      onTicketUpdated();
    } catch (error) {
      console.error('Error updating delivery ticket:', error);
      toast({
        title: 'Error',
        description: 'Failed to update delivery ticket.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Delivery Ticket Details
            </div>
            {isProjectManager && (
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditing}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={saveChanges}
                      disabled={isSaving || !editData.vendor_name.trim()}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelEditing}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Photos Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ticket.photo_url && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    General Photo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <img
                    src={ticket.photo_url}
                    alt="General delivery"
                    className="w-full h-32 object-cover rounded border"
                  />
                </CardContent>
              </Card>
            )}
            
            {ticket.delivery_slip_photo_url && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Delivery Slip
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <img
                    src={ticket.delivery_slip_photo_url}
                    alt="Delivery slip"
                    className="w-full h-32 object-cover rounded border"
                  />
                </CardContent>
              </Card>
            )}
            
            {ticket.material_photo_url && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Materials
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <img
                    src={ticket.material_photo_url}
                    alt="Materials"
                    className="w-full h-32 object-cover rounded border"
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Details */}
          <div className="grid gap-4">
            {/* Vendor Name */}
            <div className="space-y-2">
              <Label>Vendor Name</Label>
              {isEditing ? (
                <Input
                  value={editData.vendor_name}
                  onChange={(e) => setEditData({ ...editData, vendor_name: e.target.value })}
                  placeholder="Enter vendor name"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{ticket.vendor_name}</span>
                </div>
              )}
            </div>

            {/* Ticket Number & Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ticket Number</Label>
                {isEditing ? (
                  <Input
                    value={editData.ticket_number}
                    onChange={(e) => setEditData({ ...editData, ticket_number: e.target.value })}
                    placeholder="Enter ticket number"
                  />
                ) : (
                  <div>
                    {ticket.ticket_number ? (
                      <Badge variant="outline">#{ticket.ticket_number}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Not specified</span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Delivery Date</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editData.delivery_date}
                    onChange={(e) => setEditData({ ...editData, delivery_date: e.target.value })}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(ticket.delivery_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              {isEditing ? (
                <Textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Describe what was delivered..."
                  rows={3}
                />
              ) : (
                <div>
                  {ticket.description ? (
                    <p className="text-sm bg-muted/50 p-3 rounded-lg">{ticket.description}</p>
                  ) : (
                    <span className="text-muted-foreground text-sm">No description provided</span>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              {isEditing ? (
                <Textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={2}
                />
              ) : (
                <div>
                  {ticket.notes ? (
                    <p className="text-sm bg-muted/50 p-3 rounded-lg">{ticket.notes}</p>
                  ) : (
                    <span className="text-muted-foreground text-sm">No additional notes</span>
                  )}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                Created {new Date(ticket.created_at).toLocaleString()}
              </div>
              {ticket.received_by && receivedByProfile && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  Received by: {receivedByProfile.display_name}
                </div>
              )}
            </div>

            {/* Audit Trail */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5" />
                  Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAudit ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading audit trail...
                  </div>
                ) : auditTrail.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No audit trail entries found
                  </p>
                ) : (
                  <div className="space-y-3">
                    {auditTrail.map((entry) => (
                      <div key={entry.id} className="border-l-2 border-primary/20 pl-4 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium capitalize">
                            {entry.change_type}
                            {entry.field_name && ` - ${entry.field_name}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          By: {entry.user_profile?.display_name || 'Unknown User'}
                        </div>
                        {entry.old_value && entry.new_value && (
                          <div className="text-xs mt-1">
                            <span className="text-red-600">- {entry.old_value}</span>
                            <br />
                            <span className="text-green-600">+ {entry.new_value}</span>
                          </div>
                        )}
                        {entry.reason && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {entry.reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  History, 
  Plus, 
  Edit, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  Calendar,
  FileText,
  User
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  change_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
  changed_by: string;
  user_profile?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

interface BillAuditTrailProps {
  billId: string;
}

export default function BillAuditTrail({ billId }: BillAuditTrailProps) {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (billId) {
      loadAuditTrail();
    }
  }, [billId]);

  const loadAuditTrail = async () => {
    if (!billId) return;

    try {
      setLoading(true);
      
      // First, get the audit trail entries
      const { data: auditData, error: auditError } = await supabase
        .from('invoice_audit_trail')
        .select('*')
        .eq('invoice_id', billId)
        .order('created_at', { ascending: false });

      if (auditError) {
        console.error('Error loading bill audit trail:', auditError);
        return;
      }

      if (!auditData || auditData.length === 0) {
        setAuditEntries([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(auditData.map(entry => entry.changed_by).filter(Boolean))];
      
      // Fetch user profiles separately
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', userIds);

      if (profileError) {
        console.error('Error loading user profiles:', profileError);
        // Still show audit trail without names if profile fetch fails
        setAuditEntries(auditData);
        return;
      }

      // Create a map of user profiles
      const profileMap = new Map();
      profileData?.forEach(profile => {
        profileMap.set(profile.user_id, profile);
      });

      // Combine audit entries with profile data
      const entriesWithProfiles = auditData.map(entry => ({
        ...entry,
        user_profile: entry.changed_by ? profileMap.get(entry.changed_by) : null
      }));

      setAuditEntries(entriesWithProfiles);
    } catch (error) {
      console.error('Error loading bill audit trail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'create':
        return Plus;
      case 'update':
        return Edit;
      case 'approve':
        return CheckCircle;
      case 'reject':
        return XCircle;
      case 'payment':
        return DollarSign;
      default:
        return FileText;
    }
  };

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'create':
        return 'text-blue-500';
      case 'update':
        return 'text-yellow-500';
      case 'approve':
        return 'text-green-500';
      case 'reject':
        return 'text-red-500';
      case 'payment':
        return 'text-emerald-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getChangeVariant = (changeType: string) => {
    switch (changeType) {
      case 'create':
        return 'secondary';
      case 'update':
        return 'outline';
      case 'approve':
        return 'success';
      case 'reject':
        return 'destructive';
      case 'payment':
        return 'success';
      default:
        return 'outline';
    }
  };

  const getFieldDisplayName = (fieldName: string | null) => {
    switch (fieldName) {
      case 'status':
        return 'Status';
      case 'amount':
        return 'Amount';
      case 'due_date':
        return 'Due Date';
      case 'issue_date':
        return 'Issue Date';
      case 'description':
        return 'Description';
      case 'payment_terms':
        return 'Payment Terms';
      default:
        return fieldName || '';
    }
  };

  const formatValue = (fieldName: string | null, value: string | null) => {
    if (!value) return 'N/A';
    
    switch (fieldName) {
      case 'amount':
        return `$${parseFloat(value).toLocaleString()}`;
      case 'due_date':
      case 'issue_date':
        return format(new Date(value), 'MMM dd, yyyy');
      case 'status':
        return value.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      default:
        return value;
    }
  };

  const getChangeDescription = (entry: AuditEntry) => {
    const userName = entry.user_profile 
      ? `${entry.user_profile.first_name} ${entry.user_profile.last_name}`
      : 'System';

    switch (entry.change_type) {
      case 'create':
        return `${userName} created the bill`;
      case 'approve':
        return `${userName} approved the bill`;
      case 'reject':
        return `${userName} rejected the bill`;
      case 'payment':
        return `${userName} marked the bill as paid`;
      case 'update':
        if (entry.field_name) {
          return `${userName} updated ${getFieldDisplayName(entry.field_name)}`;
        }
        return `${userName} updated the bill`;
      default:
        return `${userName} made a change`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading audit trail...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Audit Trail ({auditEntries.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {auditEntries.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No audit entries found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {auditEntries.map((entry) => {
              const ChangeIcon = getChangeIcon(entry.change_type);
              return (
                <div key={entry.id} className="relative pl-8 pb-4 border-l-2 border-border last:border-l-0">
                  <div className="absolute -left-3 top-2 bg-background border-2 border-border rounded-full p-1">
                    <ChangeIcon className={`h-4 w-4 ${getChangeColor(entry.change_type)}`} />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={getChangeVariant(entry.change_type) as any}>
                          {entry.change_type.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.user_profile ? (
                          <>
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={entry.user_profile.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {entry.user_profile.first_name[0]}{entry.user_profile.last_name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {entry.user_profile.first_name} {entry.user_profile.last_name}
                            </span>
                          </>
                        ) : (
                          <>
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">System</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm font-medium text-foreground">
                      {getChangeDescription(entry)}
                    </p>
                    
                    {entry.field_name && entry.old_value && entry.new_value && (
                      <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-2">
                        <div className="font-medium text-muted-foreground">
                          {getFieldDisplayName(entry.field_name)} Change:
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">From:</span>
                          <span className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs">
                            {formatValue(entry.field_name, entry.old_value)}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                            {formatValue(entry.field_name, entry.new_value)}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {entry.reason && (
                      <div className="text-xs text-muted-foreground italic">
                        Reason: {entry.reason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
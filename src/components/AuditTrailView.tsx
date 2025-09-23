import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, User, Edit, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface AuditEntry {
  id: string;
  time_card_id: string;
  changed_by: string;
  change_type: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  reason?: string;
  created_at: string;
  profiles?: {
    display_name: string;
    first_name: string;
    last_name: string;
  };
}

interface AuditTrailViewProps {
  timeCardId: string;
}

export default function AuditTrailView({ timeCardId }: AuditTrailViewProps) {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditTrail();
  }, [timeCardId]);

  const loadAuditTrail = async () => {
    if (!timeCardId) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('time_card_audit_trail')
        .select(`
          id,
          time_card_id,
          changed_by,
          change_type,
          field_name,
          old_value,
          new_value,
          reason,
          created_at
        `)
        .eq('time_card_id', timeCardId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user profiles for the changed_by user IDs
      const userIds = [...new Set((data || []).map(entry => entry.changed_by))];
      let profilesMap: Record<string, any> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, first_name, last_name')
          .in('user_id', userIds);
        
        profilesMap = (profilesData || []).reduce((acc, profile) => {
          acc[profile.user_id] = profile;
          return acc;
        }, {} as Record<string, any>);
      }

      // Combine audit entries with profile data
      const entriesWithProfiles = (data || []).map(entry => ({
        ...entry,
        profiles: profilesMap[entry.changed_by] || null
      }));

      setAuditEntries(entriesWithProfiles);
    } catch (error) {
      console.error('Error loading audit trail:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'h:mm a');
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'create':
        return <Clock className="h-4 w-4" />;
      case 'update':
        return <Edit className="h-4 w-4" />;
      case 'approve':
        return <CheckCircle className="h-4 w-4" />;
      case 'reject':
        return <X className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'create':
        return 'secondary';
      case 'update':
        return 'outline';
      case 'approve':
        return 'default';
      case 'reject':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const formatFieldName = (fieldName: string) => {
    const fieldMap: Record<string, string> = {
      'punch_in_time': 'Punch In Time',
      'punch_out_time': 'Punch Out Time', 
      'total_hours': 'Total Hours',
      'status': 'Status'
    };
    return fieldMap[fieldName] || fieldName;
  };

  const formatValue = (fieldName: string, value: string) => {
    if (fieldName?.includes('time') && value) {
      try {
        return formatTime(value);
      } catch {
        return value;
      }
    }
    return value;
  };

  const getUserName = (entry: AuditEntry) => {
    if (entry.profiles?.display_name) return entry.profiles.display_name;
    if (entry.profiles?.first_name && entry.profiles?.last_name) {
      return `${entry.profiles.first_name} ${entry.profiles.last_name}`;
    }
    return 'System User';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading audit trail...</div>
      </div>
    );
  }

  if (auditEntries.length === 0) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">No audit trail entries found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {auditEntries.map((entry, index) => (
        <div key={entry.id}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                {getChangeTypeIcon(entry.change_type)}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={getChangeTypeColor(entry.change_type) as any} className="text-xs">
                  {entry.change_type.toUpperCase()}
                </Badge>
                <span className="text-sm font-medium">{getUserName(entry)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(entry.created_at)}
                </span>
              </div>
              
              <div className="text-sm text-muted-foreground">
                {entry.change_type === 'create' && (
                  <span>{entry.reason || 'Time card created'}</span>
                )}
                
                {entry.change_type === 'update' && entry.field_name && (
                  <div>
                    <span>Updated {formatFieldName(entry.field_name)}</span>
                    {entry.old_value && entry.new_value && (
                      <div className="mt-1 text-xs">
                        <span className="text-red-600">From: {formatValue(entry.field_name, entry.old_value)}</span>
                        <span className="mx-2">→</span>
                        <span className="text-green-600">To: {formatValue(entry.field_name, entry.new_value)}</span>
                      </div>
                    )}
                    {entry.reason && (
                      <div className="mt-1 text-xs italic">Reason: {entry.reason}</div>
                    )}
                  </div>
                )}
                
                {(entry.change_type === 'approve' || entry.change_type === 'reject') && (
                  <span>Time card {entry.change_type}d</span>
                )}
              </div>
            </div>
          </div>
          
          {index < auditEntries.length - 1 && <Separator className="mt-3" />}
        </div>
      ))}
    </div>
  );
}
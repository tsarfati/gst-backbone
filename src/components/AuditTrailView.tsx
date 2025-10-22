import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { History, User, Edit, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface AuditTrailEntry {
  id: string;
  change_type: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  reason?: string;
  created_at: string;
  changed_by: string;
  profiles?: {
    display_name: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

interface AuditTrailViewProps {
  timeCardId: string;
}

export default function AuditTrailView({ timeCardId }: AuditTrailViewProps) {
  const [auditEntries, setAuditEntries] = useState<AuditTrailEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (timeCardId) {
      loadAuditTrail();
    }
  }, [timeCardId]);

  const loadAuditTrail = async () => {
    if (!timeCardId) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('time_card_audit_trail')
        .select(`
          *
        `)
        .eq('time_card_id', timeCardId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading audit trail:', error);
        return;
      }

      // Manually fetch display names and avatars for changed_by users from both profiles and PIN employees
      const changedByIds = Array.from(new Set(data?.map(entry => entry.changed_by).filter(Boolean))) as string[];
      let nameMap: Record<string, { display_name: string; first_name?: string; last_name?: string; avatar_url?: string }> = {};

      if (changedByIds.length > 0) {
        const [profilesRes, pinRes] = await Promise.all([
          supabase.from('profiles').select('user_id, display_name, first_name, last_name, avatar_url').in('user_id', changedByIds),
          supabase.from('pin_employees').select('id, display_name, first_name, last_name, avatar_url').in('id', changedByIds)
        ]);

        if (profilesRes.data) {
          profilesRes.data.forEach((p) => {
            nameMap[p.user_id] = { 
              display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown User',
              first_name: p.first_name,
              last_name: p.last_name,
              avatar_url: p.avatar_url
            };
          });
        }
        if (pinRes.data) {
          pinRes.data.forEach((p) => {
            if (!nameMap[p.id]) {
              nameMap[p.id] = { 
                display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown User',
                first_name: p.first_name,
                last_name: p.last_name,
                avatar_url: p.avatar_url
              };
            }
          });
        }
      }

      // Combine audit entries with name data
      const entriesWithProfiles = (data || []).map(entry => ({
        ...entry,
        profiles: nameMap[entry.changed_by] || { display_name: 'Unknown User', avatar_url: undefined }
      }));

      setAuditEntries(entriesWithProfiles);
    } catch (error) {
      console.error('Error loading audit trail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'create':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'update':
        return <Edit className="h-4 w-4 text-blue-500" />;
      case 'approve':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'reject':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <History className="h-4 w-4 text-gray-500" />;
    }
  };

  const getChangeTypeBadge = (changeType: string) => {
    switch (changeType) {
      case 'create':
        return <Badge variant="default">Created</Badge>;
      case 'update':
        return <Badge variant="secondary">Updated</Badge>;
      case 'approve':
        return <Badge variant="default">Approved</Badge>;
      case 'reject':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{changeType}</Badge>;
    }
  };

  const formatFieldName = (fieldName?: string) => {
    if (!fieldName) return '';
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDateTime = (dateTime: string) => {
    return format(new Date(dateTime), 'MMM d, yyyy h:mm a');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <div>Loading audit trail...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Audit Trail ({auditEntries.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {auditEntries.length === 0 ? (
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            No audit entries found
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {auditEntries.map((entry, index) => (
                <div key={entry.id}>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarImage src={entry.profiles?.avatar_url} />
                      <AvatarFallback>
                        {entry.profiles?.first_name?.[0]}{entry.profiles?.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {getChangeTypeBadge(entry.change_type)}
                        <span className="text-sm font-medium">
                          {entry.profiles?.display_name || 'Unknown User'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(entry.created_at)}
                        </span>
                      </div>
                      
                      {entry.field_name && (
                        <div className="text-sm">
                          <span className="font-medium">{formatFieldName(entry.field_name)}</span>
                          {entry.old_value && entry.new_value && (
                            <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">From:</span>
                                <div className="bg-red-50 border border-red-200 rounded p-2 mt-1 text-foreground">
                                  {entry.old_value}
                                </div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">To:</span>
                                <div className="bg-green-50 border border-green-200 rounded p-2 mt-1 text-foreground">
                                  {entry.new_value}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {entry.reason && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <span className="font-medium">Reason:</span> {entry.reason}
                        </div>
                      )}
                    </div>
                  </div>
                  {index < auditEntries.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
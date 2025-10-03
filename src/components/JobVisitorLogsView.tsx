import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Users, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface VisitorLog {
  id: string;
  visitor_name: string;
  visitor_company?: string;
  visitor_phone?: string;
  check_in_time: string;
  check_out_time?: string;
  purpose?: string;
}

export default function JobVisitorLogsView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [id]);

  const loadLogs = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('visitor_logs')
        .select('*')
        .eq('job_id', id)
        .order('check_in_time', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading visitor logs:', error);
      toast({
        title: "Error",
        description: "Failed to load visitor logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading visitor logs...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Recent Visitors</h3>
        <Button onClick={() => navigate(`/jobs/${id}/visitor-logs`)}>
          <Eye className="h-4 w-4 mr-2" />
          View All
        </Button>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No visitor logs found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{log.visitor_name}</span>
                      {log.check_out_time ? (
                        <Badge variant="secondary">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Checked Out
                        </Badge>
                      ) : (
                        <Badge variant="default">On Site</Badge>
                      )}
                    </div>
                    {log.visitor_company && (
                      <div className="text-sm text-muted-foreground">{log.visitor_company}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      In: {format(new Date(log.check_in_time), 'MMM dd, h:mm a')}
                      {log.check_out_time && ` • Out: ${format(new Date(log.check_out_time), 'h:mm a')}`}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

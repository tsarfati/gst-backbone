import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AccessRequest {
  id: string;
  user_id: string;
  status: string;
  requested_at: string;
  notes?: string;
  profiles?: {
    first_name: string;
    last_name: string;
    display_name: string;
  };
}

export default function CompanyAccessRequests() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { currentCompany } = useCompany();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestToProcess, setRequestToProcess] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);

  useEffect(() => {
    if (currentCompany) {
      fetchAccessRequests();
    }
  }, [currentCompany]);

  const fetchAccessRequests = async () => {
    if (!currentCompany) return;

    try {
      // Fetch access requests
      const { data: requestsData, error } = await supabase
        .from('company_access_requests')
        .select('id, user_id, status, requested_at, notes')
        .eq('company_id', currentCompany.id)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for all user_ids
      const userIds = requestsData?.map(r => r.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, display_name')
        .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      // Combine the data
      setRequests(requestsData?.map(request => {
        const profile = profilesData?.find(p => p.user_id === request.user_id);
        return {
          id: request.id,
          user_id: request.user_id,
          status: request.status,
          requested_at: request.requested_at,
          notes: request.notes,
          profiles: profile ? {
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            display_name: profile.display_name || ''
          } : undefined
        };
      }) || []);
    } catch (error) {
      console.error('Error fetching access requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load access requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRequest = async () => {
    if (!requestToProcess || !currentCompany) return;

    try {
      const { id, action } = requestToProcess;
      
      // Update the request status
      const { error: updateError } = await supabase
        .from('company_access_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_by: currentUser?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // If approved, the trigger will automatically create user_company_access
      // but we can also explicitly create it here for better control
      if (action === 'approve') {
        const request = requests.find(r => r.id === id);
        if (request) {
          const { error: accessError } = await supabase
            .from('user_company_access')
            .insert({
              user_id: request.user_id,
              company_id: currentCompany.id,
              role: 'employee',
              granted_by: currentUser?.id,
              is_active: true
            });

          // Ignore duplicate errors as the trigger might have already created it
          if (accessError && !accessError.message.includes('duplicate')) {
            throw accessError;
          }
        }
      }

      toast({
        title: 'Success',
        description: `Access request ${action === 'approve' ? 'approved' : 'rejected'}`,
      });

      setRequestToProcess(null);
      fetchAccessRequests();
    } catch (error: any) {
      console.error('Error processing request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process request',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (loading) {
    return <div className="text-center p-4">Loading access requests...</div>;
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Access Requests ({pendingRequests.length})
            </CardTitle>
            <CardDescription>
              Review and approve or reject access requests to your company
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.profiles?.display_name || 
                       `${request.profiles?.first_name || ''} ${request.profiles?.last_name || ''}`.trim() ||
                       'Unknown User'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(request.requested_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {request.notes || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => setRequestToProcess({ id: request.id, action: 'approve' })}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setRequestToProcess({ id: request.id, action: 'reject' })}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Processed Requests History */}
      {processedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Request History</CardTitle>
            <CardDescription>
              Previously processed access requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.profiles?.display_name || 
                       `${request.profiles?.first_name || ''} ${request.profiles?.last_name || ''}`.trim() ||
                       'Unknown User'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(request.requested_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(request.status)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {request.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {requests.length === 0 && (
        <Card>
          <CardContent className="text-center p-8">
            <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No access requests at this time
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!requestToProcess} onOpenChange={() => setRequestToProcess(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {requestToProcess?.action === 'approve' ? 'Approve' : 'Reject'} Access Request
            </AlertDialogTitle>
            <AlertDialogDescription>
              {requestToProcess?.action === 'approve' 
                ? 'This user will be granted employee-level access to your company. You can change their role later from company management.'
                : 'This user will be denied access to your company. They can submit a new request later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleProcessRequest}>
              {requestToProcess?.action === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

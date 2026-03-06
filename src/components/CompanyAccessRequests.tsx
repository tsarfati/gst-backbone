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
  requested_role?: string;
  requested_role_label?: string | null;
  custom_role_id?: string | null;
  custom_role_name?: string | null;
  business_name?: string | null;
  invited_job_id?: string | null;
  profiles?: {
    first_name: string;
    last_name: string;
    display_name: string;
  };
}

const parseRequestedRole = (notes?: string): string => {
  if (!notes) return 'employee';
  try {
    const parsed = JSON.parse(notes);
    const role = String(parsed?.requestedRole || '').toLowerCase();
    if (role) return role;
  } catch {
    // keep default
  }
  return 'employee';
};

const parseCustomRoleName = (notes?: string): string | null => {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    const value = String(parsed?.customRoleName || '').trim();
    return value || null;
  } catch {
    return null;
  }
};

const parseCustomRoleId = (notes?: string): string | null => {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    const value = String(parsed?.customRoleId || '').trim();
    return value || null;
  } catch {
    return null;
  }
};

const parseBusinessName = (notes?: string): string | null => {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    const value = String(parsed?.businessName || '').trim();
    return value || null;
  } catch {
    return null;
  }
};

const parseInvitedJobId = (notes?: string): string | null => {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    const value = String(parsed?.invitedJobId || '').trim();
    return value || null;
  } catch {
    return null;
  }
};

type RequestedRole = 'employee' | 'vendor' | 'design_professional';
type RequestStatus = 'pending' | 'approved' | 'rejected';

interface CompanyAccessRequestsProps {
  requestedRoleFilter?: RequestedRole[];
  statusFilter?: RequestStatus | 'all';
  title?: string;
  description?: string;
}

export default function CompanyAccessRequests({
  requestedRoleFilter,
  statusFilter = 'all',
  title,
  description,
}: CompanyAccessRequestsProps) {
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
  }, [currentCompany, statusFilter, JSON.stringify(requestedRoleFilter || [])]);

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
      const mapped = requestsData?.map(request => {
        const profile = profilesData?.find(p => p.user_id === request.user_id);
        const requestedRole = parseRequestedRole(request.notes || undefined);
        return {
          id: request.id,
          user_id: request.user_id,
          status: request.status,
          requested_at: request.requested_at,
          notes: request.notes,
          requested_role: requestedRole,
          requested_role_label: parseCustomRoleName(request.notes || undefined) || requestedRole.replace('_', ' '),
          custom_role_id: parseCustomRoleId(request.notes || undefined),
          custom_role_name: parseCustomRoleName(request.notes || undefined),
          business_name: parseBusinessName(request.notes || undefined),
          invited_job_id: parseInvitedJobId(request.notes || undefined),
          profiles: profile ? {
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            display_name: profile.display_name || ''
          } : undefined
        };
      }) || [];

      const roleFiltered = requestedRoleFilter?.length
        ? mapped.filter((r) => requestedRoleFilter.includes((r.requested_role || 'employee') as RequestedRole))
        : mapped;

      const fullyFiltered = statusFilter !== 'all'
        ? roleFiltered.filter((r) => r.status === statusFilter)
        : roleFiltered;

      setRequests(fullyFiltered);
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

      const request = requests.find(r => r.id === id);
      if (!request) throw new Error("Request not found");

      if (action === 'approve') {
        const requestedRole = String(request.requested_role || 'employee').toLowerCase();
        const allowedBaseRoles = new Set([
          'admin',
          'company_admin',
          'controller',
          'project_manager',
          'design_professional',
          'employee',
          'view_only',
          'vendor',
        ]);
        const targetRole = allowedBaseRoles.has(requestedRole) ? requestedRole : 'employee';

        // Keep profile and company access role in sync with requested role.
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            role: targetRole as any,
            custom_role_id: request.custom_role_id || null,
            status: 'approved',
            approved_by: currentUser?.id || null,
            approved_at: new Date().toISOString(),
          })
          .eq('user_id', request.user_id);
        if (profileError) throw profileError;

        const { data: existingAccess, error: existingAccessError } = await supabase
          .from('user_company_access')
          .select('id')
          .eq('user_id', request.user_id)
          .eq('company_id', currentCompany.id)
          .limit(1);
        if (existingAccessError) throw existingAccessError;

        if ((existingAccess || []).length > 0) {
          const { error: accessUpdateError } = await supabase
            .from('user_company_access')
            .update({
              role: targetRole as any,
              granted_by: currentUser?.id || null,
              is_active: true,
            })
            .eq('user_id', request.user_id)
            .eq('company_id', currentCompany.id);
          if (accessUpdateError) throw accessUpdateError;
        } else {
          const { error: accessInsertError } = await supabase
            .from('user_company_access')
            .insert({
              user_id: request.user_id,
              company_id: currentCompany.id,
              role: targetRole as any,
              granted_by: currentUser?.id || null,
              is_active: true
            });
          if (accessInsertError) throw accessInsertError;
        }

        if (targetRole === 'design_professional' && request.invited_job_id) {
          const { data: existingJobAccess, error: existingJobAccessError } = await supabase
            .from('user_job_access')
            .select('id')
            .eq('user_id', request.user_id)
            .eq('job_id', request.invited_job_id)
            .limit(1);
          if (existingJobAccessError) throw existingJobAccessError;

          if ((existingJobAccess || []).length === 0) {
            const { error: jobAccessInsertError } = await supabase
              .from('user_job_access')
              .insert({
                user_id: request.user_id,
                job_id: request.invited_job_id,
                granted_by: currentUser?.id || request.user_id,
              });
            if (jobAccessInsertError) throw jobAccessInsertError;
          }
        }
      } else {
        const { error: rejectProfileError } = await supabase
          .from('profiles')
          .update({ status: 'rejected' })
          .eq('user_id', request.user_id);
        if (rejectProfileError) throw rejectProfileError;
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

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const processedRequests = requests.filter((r) => r.status !== 'pending');
  const titleText = title || `Pending Access Requests (${pendingRequests.length})`;
  const descriptionText = description || 'Review and approve or reject access requests to your company';

  if (loading) {
    return <div className="text-center p-4"><span className="loading-dots">Loading access requests</span></div>;
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {titleText}
            </CardTitle>
            <CardDescription>
              {descriptionText}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Business / Organization</TableHead>
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
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {request.custom_role_name || request.requested_role_label || request.requested_role?.replace('_', ' ') || 'employee'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {request.business_name || '-'}
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
                  <TableHead>Role</TableHead>
                  <TableHead>Business / Organization</TableHead>
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
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {request.custom_role_name || request.requested_role_label || request.requested_role?.replace('_', ' ') || 'employee'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {request.business_name || '-'}
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

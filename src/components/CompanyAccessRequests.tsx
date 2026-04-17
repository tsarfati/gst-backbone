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
  source?: 'request' | 'fallback_profile';
}

interface ParsedRequestNotes {
  requestType: string | null;
  requestedRole: string | null;
  businessName: string | null;
  invitedJobId: string | null;
  pendingJobInvites: Array<{ jobId?: string | null; companyId?: string | null }>;
  email: string | null;
}

const parseRequestNotes = (notes?: string): ParsedRequestNotes => {
  if (!notes) {
    return {
      requestType: null,
      requestedRole: null,
      businessName: null,
      invitedJobId: null,
      pendingJobInvites: [],
      email: null,
    };
  }

  try {
    const parsed = JSON.parse(notes);
    return {
      requestType: typeof parsed?.requestType === 'string' ? parsed.requestType : null,
      requestedRole: typeof parsed?.requestedRole === 'string' ? parsed.requestedRole : null,
      businessName: typeof parsed?.businessName === 'string' ? parsed.businessName : null,
      invitedJobId: typeof parsed?.invitedJobId === 'string' ? parsed.invitedJobId : null,
      pendingJobInvites: Array.isArray(parsed?.pendingJobInvites) ? parsed.pendingJobInvites : [],
      email: typeof parsed?.email === 'string' ? parsed.email : null,
    };
  } catch {
    return {
      requestType: null,
      requestedRole: null,
      businessName: null,
      invitedJobId: null,
      pendingJobInvites: [],
      email: null,
    };
  }
};

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

const isProjectDesignProfessionalInvite = (notes?: string): boolean => {
  if (!notes) return false;
  try {
    const parsed = JSON.parse(notes);
    return String(parsed?.requestedRole || '').toLowerCase() === 'design_professional'
      && Boolean(String(parsed?.invitedJobId || '').trim());
  } catch {
    return false;
  }
};

const getRequestDetails = (request: AccessRequest): string => {
  const parsedNotes = parseRequestNotes(request.notes);
  const role = String(request.requested_role || parsedNotes.requestedRole || 'employee').toLowerCase();
  const pendingJobInviteCount = parsedNotes.pendingJobInvites.length;

  if (request.source === 'fallback_profile' || parsedNotes.requestType === 'fallback_pending_profile') {
    return 'Pending profile record awaiting final approval.';
  }

  if (role === 'vendor') {
    if (pendingJobInviteCount > 0) {
      return `Vendor portal access request with ${pendingJobInviteCount} pending job invite${pendingJobInviteCount === 1 ? '' : 's'}.`;
    }
    return 'Vendor portal access request. This does not create employee access.';
  }

  if (role === 'design_professional') {
    if (pendingJobInviteCount > 0) {
      return `Design professional access request with ${pendingJobInviteCount} pending project invite${pendingJobInviteCount === 1 ? '' : 's'}.`;
    }
    return 'Design professional portal access request.';
  }

  if (parsedNotes.requestType === 'external_access_signup') {
    return 'External access request awaiting approval.';
  }

  return 'Company access request awaiting approval.';
};

const getApprovalDescription = (request?: AccessRequest | null, action?: 'approve' | 'reject' | null): string => {
  if (!request || !action) return '';

  const role = String(request.requested_role || 'employee').toLowerCase();
  if (action === 'reject') {
    if (role === 'vendor') {
      return 'This vendor connection request will be denied. The vendor can request access again later.';
    }
    if (role === 'design_professional') {
      return 'This design professional access request will be denied. They can request access again later.';
    }
    return 'This user will be denied access to your company. They can submit a new request later.';
  }

  if (role === 'vendor') {
    return 'This approves the vendor connection for your company. The vendor keeps their own BuilderLYNK account and will only see the jobs, RFPs, and invoices you share with them.';
  }

  if (role === 'design_professional') {
    return 'This approves design professional access for your company. They keep their own BuilderLYNK account and will only see the projects you share with them.';
  }

  return 'This user will be granted company access. You can adjust their role later from company management.';
};

const getRequestEntityLabel = (request?: AccessRequest | null): string => {
  const role = String(request?.requested_role || 'employee').toLowerCase();
  if (role === 'vendor') return 'Vendor Access';
  if (role === 'design_professional') return 'Design Professional Access';
  return 'Access Request';
};

const getActionLabel = (request?: AccessRequest | null, action?: 'approve' | 'reject' | null): string => {
  if (!action) return '';
  const role = String(request?.requested_role || 'employee').toLowerCase();

  if (action === 'approve') {
    if (role === 'vendor') return 'Grant Vendor Access';
    if (role === 'design_professional') return 'Grant Design Professional Access';
    return 'Approve';
  }

  if (role === 'vendor') return 'Deny Vendor Access';
  if (role === 'design_professional') return 'Deny Design Professional Access';
  return 'Reject';
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

      // Fetch profiles for all request user_ids
      const userIds = requestsData?.map(r => r.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, display_name')
        .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      // Combine explicit company access requests
      const mappedFromRequests = requestsData?.map(request => {
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
          source: 'request' as const,
          profiles: profile ? {
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            display_name: profile.display_name || ''
          } : undefined
        };
      }) || [];

      // Fallback path: include pending profiles linked to this company even when
      // company_access_requests row is missing (legacy/inconsistent data path).
      const { data: pendingAccessRows, error: pendingAccessError } = await supabase
        .from('user_company_access')
        .select('user_id, role, granted_at')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (pendingAccessError) throw pendingAccessError;

      const pendingAccessUserIds = Array.from(
        new Set((pendingAccessRows || []).map((row: any) => String(row.user_id || '')).filter(Boolean))
      );
      let pendingProfilesByUserId = new Map<string, any>();
      if (pendingAccessUserIds.length > 0) {
        const { data: pendingProfiles, error: pendingProfilesError } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name, status, created_at')
          .in('user_id', pendingAccessUserIds)
          .eq('status', 'pending');
        if (pendingProfilesError) throw pendingProfilesError;
        pendingProfilesByUserId = new Map(
          (pendingProfiles || []).map((profile: any) => [String(profile.user_id), profile])
        );
      }

      const requestUserIdSet = new Set(mappedFromRequests.map((row) => row.user_id));
      const mappedFallback = (pendingAccessRows || [])
        .filter((row: any) => !requestUserIdSet.has(String(row.user_id || '')))
        .filter((row: any) => pendingProfilesByUserId.has(String(row.user_id || '')))
        .map((row: any) => {
          const pendingProfile = pendingProfilesByUserId.get(String(row.user_id || ''));
          const fallbackRole = String(row.role || 'employee').toLowerCase();
          const createdAt = String(
            pendingProfile?.created_at
            || row.granted_at
            || new Date().toISOString()
          );
          return {
            id: `fallback:${currentCompany.id}:${row.user_id}`,
            user_id: row.user_id,
            status: 'pending',
            requested_at: createdAt,
            notes: JSON.stringify({
              requestType: 'fallback_pending_profile',
              inferredFrom: 'user_company_access',
            }),
            requested_role: fallbackRole,
            requested_role_label: fallbackRole.replace('_', ' '),
            custom_role_id: null,
            custom_role_name: null,
            business_name: null,
            invited_job_id: null,
            source: 'fallback_profile' as const,
            profiles: {
              first_name: pendingProfile?.first_name || '',
              last_name: pendingProfile?.last_name || '',
              display_name: pendingProfile?.display_name || '',
            },
          } satisfies AccessRequest;
        });

      const mapped = [...mappedFromRequests, ...mappedFallback]
        .filter((request) => !isProjectDesignProfessionalInvite(request.notes || undefined));

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
      const isFallbackRequest = id.startsWith(`fallback:${currentCompany.id}:`);
      const request = requests.find(r => r.id === id);
      if (!request) throw new Error("Request not found");
      
      if (!isFallbackRequest) {
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
      }

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

        if (isFallbackRequest) {
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

      if (currentUser?.id) {
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('type', `intake_queue:${request.user_id}`);
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
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => {
                  const approveLabel = getActionLabel(request, 'approve');
                  const rejectLabel = getActionLabel(request, 'reject');
                  return (
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
                      {getRequestDetails(request)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => setRequestToProcess({ id: request.id, action: 'approve' })}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          {approveLabel}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setRequestToProcess({ id: request.id, action: 'reject' })}
                        >
                          <X className="h-4 w-4 mr-1" />
                          {rejectLabel}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
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
                  <TableHead>Details</TableHead>
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
                      {getRequestDetails(request)}
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
              {requestToProcess
                ? `${requestToProcess.action === 'approve' ? 'Approve' : 'Reject'} ${getRequestEntityLabel(
                    requests.find((request) => request.id === requestToProcess.id),
                  )}`
                : 'Access Request'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getApprovalDescription(
                requestToProcess ? requests.find((request) => request.id === requestToProcess.id) : null,
                requestToProcess?.action || null,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleProcessRequest}>
              {getActionLabel(
                requestToProcess ? requests.find((request) => request.id === requestToProcess.id) : null,
                requestToProcess?.action || null,
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

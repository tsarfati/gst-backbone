import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, User, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface AccessRequest {
  id: string;
  user_id: string;
  company_id: string;
  requested_at: string;
  status: string;
  notes?: string;
  user_profile?: {
    first_name?: string;
    last_name?: string;
    display_name?: string;
    nickname?: string;
    birthday?: string;
    avatar_url?: string;
  };
}

export default function CompanyAccessApproval() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (currentCompany) {
      fetchAccessRequests();
    }
  }, [currentCompany]);

  const fetchAccessRequests = async () => {
    if (!currentCompany) return;

    try {
      // First get the requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('company_access_requests')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('requested_at', { ascending: false });

      if (requestsError) throw requestsError;

        // Then get user profiles for each request
        const requestsWithProfiles = await Promise.all(
          (requestsData || []).map(async (request) => {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('first_name, last_name, display_name, nickname, birthday, avatar_url')
              .eq('user_id', request.user_id)
              .single();

          if (profileError) {
            console.warn('Error fetching profile for user:', request.user_id, profileError);
          }

          return {
            ...request,
            user_profile: profile || {}
          };
        })
      );

      setRequests(requestsWithProfiles);
    } catch (error) {
      console.error('Error fetching access requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load access requests',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId: string, action: 'approved' | 'rejected', userId: string) => {
    if (!user || !currentCompany) return;

    setProcessing(requestId);
    try {
      // Update the request status
      const { error: requestError } = await supabase
        .from('company_access_requests')
        .update({
          status: action,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          notes: notes
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      // If approved, grant company access
      if (action === 'approved') {
        const { error: accessError } = await supabase
          .from('user_company_access')
          .insert({
            user_id: userId,
            company_id: currentCompany.id,
            role: 'employee',
            is_active: true,
            granted_by: user.id
          });

        if (accessError) {
          // If access already exists, try to update it
          const { error: updateError } = await supabase
            .from('user_company_access')
            .update({
              is_active: true,
              granted_by: user.id
            })
            .eq('user_id', userId)
            .eq('company_id', currentCompany.id);

          if (updateError) {
            console.warn('Error granting access:', updateError);
          }
        }
      }

      toast({
        title: action === 'approved' ? 'Request Approved' : 'Request Rejected',
        description: `Access request has been ${action}.`,
      });

      setNotes('');
      fetchAccessRequests();
    } catch (error: any) {
      console.error('Error processing request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process request',
        variant: 'destructive'
      });
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  if (loading) {
    return <div className="text-center">Loading access requests...</div>;
  }

  return (
    <div className="space-y-6">
      {pendingRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Clock className="mr-2 h-5 w-5 text-yellow-500" />
            Pending Requests ({pendingRequests.length})
          </h3>
          <div className="grid gap-4">
            {pendingRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={request.user_profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {`${request.user_profile?.first_name?.charAt(0) || ''}${request.user_profile?.last_name?.charAt(0) || ''}`.toUpperCase() || <User className="h-6 w-6" />}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">
                          {request.user_profile?.display_name || 
                           `${request.user_profile?.first_name || ''} ${request.user_profile?.last_name || ''}`.trim() ||
                           'Unknown User'}
                        </CardTitle>
                        {request.user_profile?.nickname && (
                          <p className="text-sm text-muted-foreground">
                            "{request.user_profile.nickname}"
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Requested: {formatDate(request.requested_at)}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          disabled={processing === request.id}
                          onClick={() => setNotes('')}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Approve Access Request</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="approval-notes">Notes (optional)</Label>
                            <Textarea
                              id="approval-notes"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Add any notes about this approval..."
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button
                              onClick={() => handleRequest(request.id, 'approved', request.user_id)}
                              disabled={processing === request.id}
                            >
                              Approve Access
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          disabled={processing === request.id}
                          onClick={() => setNotes('')}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reject Access Request</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="rejection-notes">Reason for rejection (optional)</Label>
                            <Textarea
                              id="rejection-notes"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Add any notes about why this request was rejected..."
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="destructive"
                              onClick={() => handleRequest(request.id, 'rejected', request.user_id)}
                              disabled={processing === request.id}
                            >
                              Reject Request
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {processedRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="grid gap-2">
            {processedRequests.slice(0, 10).map((request) => (
              <Card key={request.id} className="bg-muted/50">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <User className="h-6 w-6 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">
                          {request.user_profile?.display_name || 
                           `${request.user_profile?.first_name || ''} ${request.user_profile?.last_name || ''}`.trim() ||
                           'Unknown User'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(request.requested_at)}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                  </div>
                  {request.notes && (
                    <p className="text-sm text-muted-foreground mt-2 ml-9">
                      "{request.notes}"
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="text-center py-8">
          <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Access Requests</h3>
          <p className="text-muted-foreground">
            There are currently no access requests for this company.
          </p>
        </div>
      )}
    </div>
  );
}
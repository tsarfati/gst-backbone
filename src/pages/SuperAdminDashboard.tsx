import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  Building2, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search,
  Shield,
  ArrowLeft,
  LogOut
} from 'lucide-react';

interface TenantAccessRequest {
  id: string;
  user_id: string;
  tenant_name: string;
  notes: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  user_email?: string;
  user_name?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  max_companies: number | null;
  is_active: boolean;
  created_at: string;
  owner_email?: string;
  company_count?: number;
  member_count?: number;
}

interface UserProfile {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const { user, signOut } = useAuth();
  const { isSuperAdmin, loading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<TenantAccessRequest[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantLoading && !isSuperAdmin) {
      navigate('/', { replace: true });
    }
  }, [isSuperAdmin, tenantLoading, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchData();
    }
  }, [isSuperAdmin]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch pending requests with user info
      const { data: requestsData, error: requestsError } = await supabase
        .from('tenant_access_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Get user emails for requests
      const userIds = [...new Set(requestsData?.map(r => r.user_id) || [])];
      let userProfiles: Record<string, { email?: string; name?: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        if (profiles) {
          profiles.forEach(p => {
            userProfiles[p.user_id] = {
              name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'
            };
          });
        }

        // Get emails from auth.users via edge function or similar
        // For now, we'll just use the profile names
      }

      const enrichedRequests = requestsData?.map(r => ({
        ...r,
        user_name: userProfiles[r.user_id]?.name || 'Unknown User'
      })) || [];

      setRequests(enrichedRequests);

      // Fetch all tenants with counts
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_members (count),
          companies (count)
        `)
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;

      const enrichedTenants = tenantsData?.map(t => ({
        ...t,
        member_count: (t.tenant_members as any)?.[0]?.count || 0,
        company_count: (t.companies as any)?.[0]?.count || 0
      })) || [];

      setTenants(enrichedTenants);

      // Fetch all users (profiles) for super admin view
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name, role, status, created_at, phone')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      setUsers(allProfiles?.map(p => ({
        ...p,
        display_name: p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown User'
      })) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data. Please refresh the page.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (request: TenantAccessRequest) => {
    if (!user) return;
    
    setProcessingId(request.id);

    try {
      // Create slug from tenant name
      const slug = request.tenant_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Create the tenant
      const { data: newTenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: request.tenant_name,
          slug: slug + '-' + Date.now().toString(36),
          owner_id: request.user_id,
          subscription_tier: 'free',
          is_active: true
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Add user as tenant owner
      const { error: memberError } = await supabase
        .from('tenant_members')
        .insert({
          tenant_id: newTenant.id,
          user_id: request.user_id,
          role: 'owner'
        });

      if (memberError) throw memberError;

      // Update request status
      const { error: updateError } = await supabase
        .from('tenant_access_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      toast({
        title: 'Request Approved',
        description: `Created organization "${request.tenant_name}" successfully.`,
      });

      await fetchData();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRequest = async (request: TenantAccessRequest) => {
    if (!user) return;
    
    setProcessingId(request.id);

    try {
      const { error } = await supabase
        .from('tenant_access_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .eq('id', request.id);

      if (error) throw error;

      toast({
        title: 'Request Rejected',
        description: 'The request has been rejected.',
      });

      await fetchData();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    (u.display_name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    (u.first_name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    (u.last_name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    (u.phone || '').toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingRequests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenants.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tenants.reduce((acc, t) => acc + (t.company_count || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tenants.reduce((acc, t) => acc + (t.member_count || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList>
            <TabsTrigger value="requests" className="relative">
              Access Requests
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 text-xs">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tenants">Organizations</TabsTrigger>
            <TabsTrigger value="users">All Users</TabsTrigger>
            <TabsTrigger value="history">Request History</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Access Requests</CardTitle>
                <CardDescription>
                  Review and approve requests to create new organizations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No pending requests</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Organization Name</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">
                            {request.user_name}
                          </TableCell>
                          <TableCell>{request.tenant_name}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {request.notes || '-'}
                          </TableCell>
                          <TableCell>
                            {new Date(request.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApproveRequest(request)}
                                disabled={processingId === request.id}
                              >
                                {processingId === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                )}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectRequest(request)}
                                disabled={processingId === request.id}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tenants" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Organizations</CardTitle>
                <CardDescription>
                  View and manage all organizations on the platform.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search organizations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {filteredTenants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No organizations found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Companies</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.map((tenant) => (
                        <TableRow 
                          key={tenant.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/super-admin/tenant/${tenant.id}`)}
                        >
                          <TableCell className="font-medium">{tenant.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {tenant.subscription_tier}
                            </Badge>
                          </TableCell>
                          <TableCell>{tenant.company_count || 0}</TableCell>
                          <TableCell>{tenant.member_count || 0}</TableCell>
                          <TableCell>
                            <Badge variant={tenant.is_active ? "default" : "destructive"}>
                              {tenant.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(tenant.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>
                  View and manage all users across the platform.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name or phone..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No users found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((userProfile) => (
                        <TableRow 
                          key={userProfile.user_id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/settings/users/${userProfile.user_id}`)}
                        >
                          <TableCell className="font-medium">{userProfile.display_name}</TableCell>
                          <TableCell>{userProfile.phone || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {userProfile.role || 'None'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={userProfile.status === 'approved' ? 'default' : 'outline'} className="capitalize">
                              {userProfile.status || 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(userProfile.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Request History</CardTitle>
                <CardDescription>
                  View all processed access requests.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {processedRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No processed requests</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Organization Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Processed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">
                            {request.user_name}
                          </TableCell>
                          <TableCell>{request.tenant_name}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={request.status === 'approved' ? 'default' : 'destructive'}
                              className="capitalize"
                            >
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(request.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {request.reviewed_at 
                              ? new Date(request.reviewed_at).toLocaleDateString()
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

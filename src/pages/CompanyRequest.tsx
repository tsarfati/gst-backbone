import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2, CheckCircle, User, ArrowRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

interface Company {
  id: string;
  name: string;
  display_name?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
}

interface AccessRequest {
  company_id: string;
  is_active: boolean;
  status?: string;
}

export default function CompanyRequest() {
  const { user, profile, signOut } = useAuth();
  const { switchCompany } = useCompany();
  const { currentTenant, tenantMember } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingAccess, setRequestingAccess] = useState<string | null>(null);
  const [selectingCompany, setSelectingCompany] = useState<string | null>(null);
  const [showCreateCompanyDialog, setShowCreateCompanyDialog] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: '',
    display_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: ''
  });

  // Check if user can create companies (tenant owner or admin)
  const canCreateCompany = tenantMember?.role === 'owner' || tenantMember?.role === 'admin';

  // Resolve storage paths to public URLs using Supabase Storage API
  const resolveLogoUrl = (logo?: string) => {
    if (!logo) return undefined;
    if (/^https?:\/\//i.test(logo)) return logo;
    const raw = logo.replace(/^\/+/, '');
    if (raw.includes('/')) {
      const [bucket, ...rest] = raw.split('/');
      const filePath = rest.join('/');
      return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
    }
    // Fallback to company-logos bucket
    return supabase.storage.from('company-logos').getPublicUrl(raw).data.publicUrl;
  };

  useEffect(() => {
    if (user && currentTenant) {
      fetchCompanies();
      fetchAccessRequests();
    }
  }, [user, currentTenant?.id]);

  const fetchCompanies = async () => {
    if (!currentTenant) return;
    
    try {
      // Only fetch companies within the user's tenant
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('is_active', true)
        .eq('tenant_id', currentTenant.id)
        .order('name');

      if (error) throw error;
      console.log('Fetched companies for tenant:', currentTenant.name, data);
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load companies',
        variant: 'destructive'
      });
    }
  };

  const fetchAccessRequests = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('company_access_requests')
        .select('company_id, status')
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Also fetch approved company access from user_company_access
      const { data: approvedAccess, error: accessError } = await supabase
        .from('user_company_access')
        .select('company_id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (accessError) console.error('Error fetching approved access:', accessError);

      // Combine request data with approved access
      const combinedRequests = (data || []).map(req => ({
        company_id: req.company_id,
        is_active: req.status === 'approved',
        status: req.status
      }));

      // Add approved access that might not have requests
      (approvedAccess || []).forEach(access => {
        if (!combinedRequests.find(req => req.company_id === access.company_id)) {
          combinedRequests.push({
            company_id: access.company_id,
            is_active: true,
            status: 'approved'
          });
        }
      });

      setAccessRequests(combinedRequests);
    } catch (error) {
      console.error('Error fetching access requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestAccess = async (companyId: string) => {
    if (!user) return;

    setRequestingAccess(companyId);
    try {
      const { error } = await supabase
        .from('company_access_requests')
        .insert({
          user_id: user.id,
          company_id: companyId,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: 'Request Sent',
        description: 'Your access request has been sent to the company administrators.',
      });

      // Refresh access requests
      await fetchAccessRequests();
    } catch (error: any) {
      console.error('Error requesting access:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send access request',
        variant: 'destructive'
      });
    } finally {
      setRequestingAccess(null);
    }
  };

  const getRequestStatus = (companyId: string) => {
    const request = accessRequests.find(r => r.company_id === companyId);
    if (!request) return 'none';
    if (request.is_active) return 'approved';
    return request.status || 'pending';
  };

  const hasAnyApprovedAccess = accessRequests.some(r => r.is_active);

  const selectCompany = async (companyId: string) => {
    if (!user) return;

    setSelectingCompany(companyId);
    try {
      // If already approved, skip RPC activation
      const status = getRequestStatus(companyId);
      if (status !== 'approved') {
        try {
          await supabase.rpc('activate_company_access', { _company_id: companyId });
        } catch (rpcErr) {
          console.warn('activate_company_access failed, proceeding if access exists:', rpcErr);
        }
      }

      // Switch to the company regardless (AccessControl will validate real access)
      await switchCompany(companyId);
      
      // After successful switch, go to dashboard without full reload
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error('Error selecting company:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to select company',
        variant: 'destructive'
      });
      setSelectingCompany(null);
    }
  };

  const handleCreateCompany = async () => {
    if (!user || !currentTenant || !newCompanyForm.name.trim()) return;

    setCreatingCompany(true);
    try {
      // Create the company within the user's tenant
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          ...newCompanyForm,
          created_by: user.id,
          tenant_id: currentTenant.id
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Grant admin access to the creator
      const { error: accessError } = await supabase
        .from('user_company_access')
        .insert({
          user_id: user.id,
          company_id: companyData.id,
          role: 'admin',
          granted_by: user.id
        });

      if (accessError) throw accessError;

      // Update the current user's profile to set the new company as current
      await supabase
        .from('profiles')
        .update({ current_company_id: companyData.id })
        .eq('user_id', user.id);

      toast({
        title: 'Success',
        description: 'Company created successfully! You are now an admin.'
      });

      // Switch to the new company and go to dashboard
      await switchCompany(companyData.id);
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create company',
        variant: 'destructive'
      });
    } finally {
      setCreatingCompany(false);
      setShowCreateCompanyDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* User Profile Header */}
        {profile && (
          <Card className="mb-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">Your Profile</CardTitle>
              <Button variant="outline" onClick={signOut}>
                Log Out
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-lg">
                    {`${profile.first_name?.charAt(0) || ''}${profile.last_name?.charAt(0) || ''}`.toUpperCase() || <User className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">
                    {profile.display_name || `${profile.first_name} ${profile.last_name}`}
                  </h3>
                  {profile.nickname && (
                    <p className="text-sm text-muted-foreground">"{profile.nickname}"</p>
                  )}
                  {profile.birthday && (
                    <p className="text-sm text-muted-foreground">
                      Birthday: {new Date(profile.birthday).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Request Company Access</h1>
          <p className="text-muted-foreground text-lg">
            {hasAnyApprovedAccess 
              ? "You have access to company resources. You can request access to additional companies below."
              : "Select a company to request access. A company administrator will review your profile and approve your request."
            }
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => {
            const status = getRequestStatus(company.id);
            
            return (
              <Card key={company.id} className="relative overflow-hidden h-48 group cursor-pointer hover:shadow-lg transition-shadow">
                {/* Status Badge */}
                {status === 'approved' && (
                  <Badge variant="default" className="absolute top-3 right-3 z-10 bg-green-500 hover:bg-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approved
                  </Badge>
                )}
                {status === 'pending' && (
                  <Badge variant="outline" className="absolute top-3 right-3 z-10 bg-background">
                    Pending
                  </Badge>
                )}

                {/* Logo spanning the whole tile */}
                <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-background to-muted/50">
                  {company.logo_url ? (
                    <div className="w-full h-full flex items-center justify-center p-4">
                      <img 
                        src={resolveLogoUrl(company.logo_url)} 
                        alt={`${company.name} logo`}
                        className="max-w-full max-h-full object-contain"
                        onLoad={() => console.log(`Logo loaded for ${company.name}:`, resolveLogoUrl(company.logo_url))}
                        onError={(e) => {
                          console.error(`Logo failed to load for ${company.name}:`, resolveLogoUrl(company.logo_url));
                          console.error('Error details:', e);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6">
                      <Building2 className="h-16 w-16 text-muted-foreground mb-3" />
                      <h3 className="font-semibold text-lg text-foreground mb-1">
                        {company.display_name || company.name}
                      </h3>
                      {company.city && company.state && (
                        <p className="text-sm text-muted-foreground">
                          {company.city}, {company.state}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        No logo available
                      </p>
                    </div>
                  )}

                  {/* Overlay with action button - appears on hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {status === 'none' && (
                      <Button 
                        onClick={() => requestAccess(company.id)}
                        disabled={requestingAccess === company.id}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {requestingAccess === company.id && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Request Access
                      </Button>
                    )}
                    
                    {status === 'pending' && (
                      <Button disabled variant="secondary">
                        Request Pending
                      </Button>
                    )}
                    
                    {status === 'approved' && (
                      <Button 
                        onClick={() => selectCompany(company.id)}
                        disabled={selectingCompany === company.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {selectingCompany === company.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="mr-2 h-4 w-4" />
                        )}
                        Select Company
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {companies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Companies Available</h3>
            <p className="text-muted-foreground mb-6">
              {currentTenant 
                ? canCreateCompany
                  ? `No companies have been set up in "${currentTenant.name}" yet. As an organization ${tenantMember?.role}, you can create the first company.`
                  : `There are no companies set up yet in "${currentTenant.name}". Please contact your organization administrator.`
                : "There are currently no companies available to request access to."
              }
            </p>
            {canCreateCompany && currentTenant && (
              <Button onClick={() => setShowCreateCompanyDialog(true)} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Company
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create Company Dialog */}
      <Dialog open={showCreateCompanyDialog} onOpenChange={setShowCreateCompanyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
            <DialogDescription>
              Set up a new company within {currentTenant?.name}. You will be added as an admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name *</Label>
              <Input
                id="company-name"
                value={newCompanyForm.name}
                onChange={(e) => setNewCompanyForm({ ...newCompanyForm, name: e.target.value })}
                placeholder="Enter company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={newCompanyForm.display_name}
                onChange={(e) => setNewCompanyForm({ ...newCompanyForm, display_name: e.target.value })}
                placeholder="Optional display name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={newCompanyForm.city}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={newCompanyForm.state}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, state: e.target.value })}
                  placeholder="State"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newCompanyForm.phone}
                onChange={(e) => setNewCompanyForm({ ...newCompanyForm, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newCompanyForm.email}
                onChange={(e) => setNewCompanyForm({ ...newCompanyForm, email: e.target.value })}
                placeholder="Company email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCompanyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCompany}
              disabled={!newCompanyForm.name.trim() || creatingCompany}
            >
              {creatingCompany && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
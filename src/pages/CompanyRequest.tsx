import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2, User, Plus, ArrowRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

export default function CompanyRequest() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { switchCompany, refreshCompanies, userCompanies } = useCompany();
  const { currentTenant, tenantMember } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [selectingCompany, setSelectingCompany] = useState<string | null>(null);
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

  useEffect(() => {
    // Check if user already has companies they can access
    if (userCompanies && userCompanies.length > 0) {
      setLoading(false);
    } else if (currentTenant) {
      setLoading(false);
    }
  }, [userCompanies, currentTenant]);

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

      // Grant admin access to the creator (use upsert to handle if it already exists from a trigger)
      const { error: accessError } = await supabase
        .from('user_company_access')
        .upsert({
          user_id: user.id,
          company_id: companyData.id,
          role: 'admin',
          granted_by: user.id
        }, { 
          onConflict: 'user_id,company_id',
          ignoreDuplicates: false 
        });

      if (accessError) throw accessError;

      // Update the current user's profile to set the new company as current AND set role to admin
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          current_company_id: companyData.id,
          role: 'admin'
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      toast({
        title: 'Success',
        description: 'Company created successfully! You are now an admin.'
      });

      // Refresh profile to update role in auth context
      await refreshProfile();
      
      // Refresh companies and switch to the new company
      await refreshCompanies();
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
    }
  };

  const selectCompany = async (companyId: string) => {
    if (!user) return;

    setSelectingCompany(companyId);
    try {
      await switchCompany(companyId);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If user already has companies, show company selection
  if (userCompanies && userCompanies.length > 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          {/* User Profile Header */}
          {profile && (
            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl">Welcome back!</CardTitle>
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
                    <p className="text-sm text-muted-foreground">
                      {currentTenant?.name}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Select a Company</h1>
          </div>

          <div className="space-y-4">
            {userCompanies.map((uc) => (
              <Card 
                key={uc.company_id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => selectCompany(uc.company_id)}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{uc.company_name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">{uc.role}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    disabled={selectingCompany === uc.company_id}
                  >
                    {selectingCompany === uc.company_id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ArrowRight className="h-5 w-5" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {canCreateCompany && (
            <div className="mt-8 text-center">
              <Button variant="outline" onClick={() => navigate('/company-management')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Another Company
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // No companies - show create company form for owners/admins
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-xl mx-auto">
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
                  <p className="text-sm text-muted-foreground">
                    {currentTenant?.name}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {canCreateCompany ? (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Create Your First Company</CardTitle>
              <CardDescription>
                Set up your company to start using BuilderLYNK. You'll be added as an admin with full access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name *</Label>
                <Input
                  id="company-name"
                  value={newCompanyForm.name}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, name: e.target.value })}
                  placeholder="Enter your company name"
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={newCompanyForm.display_name}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, display_name: e.target.value })}
                  placeholder="Optional short name"
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
                  placeholder="Company phone number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCompanyForm.email}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, email: e.target.value })}
                  placeholder="Company email address"
                />
              </div>

              <Button 
                onClick={handleCreateCompany}
                disabled={!newCompanyForm.name.trim() || creatingCompany}
                className="w-full mt-6"
                size="lg"
              >
                {creatingCompany ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Company...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-5 w-5" />
                    Create Company
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-2xl">No Companies Available</CardTitle>
              <CardDescription>
                Your organization hasn't set up any companies yet. Please contact your organization administrator to create a company.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}

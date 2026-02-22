import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Users, UserPlus, Shield, Trash2, Edit, Plus, Upload, Camera, Share2, FileText, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CompanyAccessApproval from '@/components/CompanyAccessApproval';
import PdfTemplateSettings from '@/components/PdfTemplateSettings';
import AIAInvoiceTemplateSettings from '@/components/AIAInvoiceTemplateSettings';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompanyUser {
  id: string;
  user_id: string;
  company_id: string;
  role: string;
  is_active: boolean;
  granted_at: string;
  profile?: {
    display_name?: string;
    first_name?: string;
    last_name?: string;
  };
}

export default function CompanyManagement() {
  const { currentCompany, userCompanies, refreshCompanies } = useCompany();
  const { user } = useAuth();
  const { currentTenant, tenantMember } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<CompanyUser | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditCompanyDialog, setShowEditCompanyDialog] = useState(false);
  const [showCreateCompanyDialog, setShowCreateCompanyDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('employee');
  const [companyForm, setCompanyForm] = useState({
    name: '',
    display_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    website: '',
    enable_shared_vendor_database: false
  });
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: '',
    display_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    website: '',
    enable_shared_vendor_database: false
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Get current user's role in this company
  const currentUserCompany = userCompanies.find(uc => uc.company_id === currentCompany?.id);
  const isCompanyAdmin = currentUserCompany?.role === 'admin' || currentUserCompany?.role === 'controller';
  const isOwnerOrAdmin = currentUserCompany?.role === 'admin';

  // Helper function to get user IDs that have access to a company
  const getCompanyUserIds = async (companyId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('user_company_access')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('is_active', true);
    
    if (error) {
      console.error('Error fetching company user IDs:', error);
      return [];
    }
    
    return data?.map(item => item.user_id) || [];
  };

  const fetchCompanyUsers = async () => {
    if (!currentCompany) return;

    try {
      console.log('Fetching users for company:', currentCompany.id);
      
      // Fetch regular users from user_company_access
      const { data: userAccessData, error: accessError } = await supabase
        .from('user_company_access')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      console.log('User access data:', userAccessData, 'error:', accessError);

      if (accessError) throw accessError;

      let combinedUsers: CompanyUser[] = [];

      // Process regular users if they exist
      if (userAccessData && userAccessData.length > 0) {
        // Get user IDs to fetch profiles with role
        const userIds = userAccessData.map(access => access.user_id);
        console.log('User IDs to fetch:', userIds);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, display_name, first_name, last_name, role')
          .in('user_id', userIds);

        console.log('Profiles data:', profilesData, 'error:', profilesError);

        if (profilesError) throw profilesError;

        // Combine the regular user data
        const regularUsers = userAccessData.map(access => {
          const profile = profilesData?.find(profile => profile.user_id === access.user_id);
          return {
            ...access,
            role: profile?.role || access.role,
            profile
          };
        });

        combinedUsers = [...regularUsers];
      }

      setUsers(combinedUsers);
    } catch (error) {
      console.error('Error fetching company users:', error);
      toast({
        title: "Error",
        description: "Failed to load company users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!currentCompany || !newUserEmail.trim()) return;

    try {
      // First, check if user exists in the system
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', newUserEmail); // This would need to be email lookup

      if (profileError) throw profileError;

      // For now, show a message that user invitation system needs to be implemented
      toast({
        title: "Feature in development",
        description: "User invitation system will be implemented in the next update. For now, users need to sign up first.",
        variant: "default"
      });

      setShowAddUserDialog(false);
      setNewUserEmail('');
      setNewUserRole('employee');
    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: "Error",
        description: "Failed to add user to company",
        variant: "destructive"
      });
    }
  };

  const handleCreateCompany = async () => {
    if (!user || !newCompanyForm.name.trim()) return;

    try {
      // Ensure user has a tenant before creating company
      if (!currentTenant) {
        toast({
          title: "Error",
          description: "You must belong to an organization to create a company",
          variant: "destructive"
        });
        return;
      }

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
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ current_company_id: companyData.id })
        .eq('user_id', user.id);

      if (profileError) {
        console.warn('Failed to update current company:', profileError);
      }

      toast({
        title: "Success",
        description: "Company created successfully and you've been added as admin"
      });

      setShowCreateCompanyDialog(false);
      setNewCompanyForm({
        name: '',
        display_name: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        phone: '',
        email: '',
        website: '',
        enable_shared_vendor_database: false
      });
      
      await refreshCompanies();
    } catch (error) {
      console.error('Error creating company:', error);
      toast({
        title: "Error",
        description: "Failed to create company",
        variant: "destructive"
      });
    }
  };

  const handleUpdateCompany = async () => {
    if (!currentCompany) return;

    try {
      const { error } = await supabase
        .from('companies')
        .update(companyForm)
        .eq('id', currentCompany.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company information updated successfully"
      });

      setShowEditCompanyDialog(false);
      await refreshCompanies();
    } catch (error) {
      console.error('Error updating company:', error);
      toast({
        title: "Error",
        description: "Failed to update company information",
        variant: "destructive"
      });
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!currentCompany) return;

    try {
      const { error } = await supabase
        .from('user_company_access')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('company_id', currentCompany.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed from company"
      });

      fetchCompanyUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "Failed to remove user from company",
        variant: "destructive"
      });
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentCompany) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 2MB",
        variant: "destructive"
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    setUploadingLogo(true);

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}/company-logo-${Date.now()}.${fileExt}`;
      
      // Upload to company-logos bucket
      const { data, error } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file);

      if (error) throw error;

      // Get the storage path (not full URL)
      const logoPath = `company-logos/${fileName}`;

      // Update company record with logo path
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: logoPath })
        .eq('id', currentCompany.id);

      if (updateError) throw updateError;

      // Refresh company data to show new logo
      await refreshCompanies();
      
      toast({
        title: "Success", 
        description: "Company logo updated successfully"
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: "Failed to upload company logo",
        variant: "destructive"
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  useEffect(() => {
    if (currentCompany) {
      fetchCompanyUsers();
      setCompanyForm({
        name: currentCompany.name || '',
        display_name: currentCompany.display_name || '',
        address: currentCompany.address || '',
        city: currentCompany.city || '',
        state: currentCompany.state || '',
        zip_code: currentCompany.zip_code || '',
        phone: currentCompany.phone || '',
        email: currentCompany.email || '',
        website: currentCompany.website || '',
        enable_shared_vendor_database: currentCompany.enable_shared_vendor_database || false
      });
    }
  }, [currentCompany]);

  if (!currentCompany && userCompanies.length === 0) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <CardTitle>No Companies Found</CardTitle>
            <CardDescription>
              You don't have access to any companies yet. Create your first company to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateCompanyDialog(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Company
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <CardTitle>No Company Selected</CardTitle>
            <CardDescription>
              Please select a company to manage its settings and users.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company Management</h1>
          <p className="text-muted-foreground">
            Manage {currentCompany.display_name || currentCompany.name} settings and users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCreateCompanyDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Company
          </Button>
          {isCompanyAdmin && (
            <Button onClick={() => setShowEditCompanyDialog(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Company
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">
            <Building2 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="h-4 w-4 mr-2" />
            PDF Templates
          </TabsTrigger>
          <TabsTrigger value="aia-templates">
            <FileText className="h-4 w-4 mr-2" />
            AIA Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">

      {/* Company Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
          <CardDescription>
            Basic information about your company
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6 mb-6">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-20 w-20">
                <AvatarImage 
                  src={currentCompany.logo_url ? `https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/${currentCompany.logo_url}` : undefined}
                  alt={`${currentCompany.name} logo`}
                />
                <AvatarFallback className="text-lg bg-primary/10">
                  {currentCompany.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isCompanyAdmin && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingLogo}
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    {uploadingLogo ? (
                      <>Uploading...</>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        Upload Logo
                      </>
                    )}
                  </Button>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{currentCompany.display_name || currentCompany.name}</h3>
              <p className="text-sm text-muted-foreground">Company Logo</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Company Name</Label>
              <p className="text-sm text-muted-foreground">{currentCompany.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Display Name</Label>
              <p className="text-sm text-muted-foreground">{currentCompany.display_name || 'Not set'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Phone</Label>
              <p className="text-sm text-muted-foreground">{currentCompany.phone || 'Not set'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Email</Label>
              <p className="text-sm text-muted-foreground">{currentCompany.email || 'Not set'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor Sharing Settings Card - Only show for company admins */}
      {isCompanyAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Vendor Database Sharing
            </CardTitle>
            <CardDescription>
              Configure whether this company participates in shared vendor database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-blue-600" />
                  <Label className="text-sm font-medium">Enable Shared Vendor Database</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  When enabled, your company can access vendor contact information from other companies that also enable this setting. 
                  Jobs, invoices, and other company-specific data remain separate and private.
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• Share: Vendor names, addresses, phone numbers, emails</div>
                  <div>• Keep separate: Jobs, invoices, payments, company-specific notes</div>
                </div>
              </div>
              <Switch
                checked={currentCompany?.enable_shared_vendor_database || false}
                onCheckedChange={async (checked) => {
                  try {
                    const { error } = await supabase
                      .from('companies')
                      .update({ enable_shared_vendor_database: checked })
                      .eq('id', currentCompany?.id);

                    if (error) throw error;

                    await refreshCompanies();
                    
                    toast({
                      title: checked ? "Shared vendor database enabled" : "Shared vendor database disabled",
                      description: checked 
                        ? "Your company can now access shared vendor information from other participating companies."
                        : "Your company will only see vendors specifically added to your company.",
                    });
                  } catch (error) {
                    console.error('Error updating vendor sharing setting:', error);
                    toast({
                      title: "Error",
                      description: "Failed to update vendor sharing setting",
                      variant: "destructive"
                    });
                  }
                }}
              />
            </div>
            
            {currentCompany?.enable_shared_vendor_database && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-blue-900">Privacy & Security</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>✓ Only basic vendor contact information is shared between companies</p>
                      <p>✓ Your jobs, invoices, and financial data remain completely private</p>
                      <p>✓ You can disable this feature at any time</p>
                      <p>✓ Shared vendors appear with a "Shared" badge for identification</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Journal Entry Settings Card - Only show for company admins */}
      {isCompanyAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Journal Entry Settings
            </CardTitle>
            <CardDescription>
              Configure how journal entries can be managed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Allow Journal Entry Deletion</Label>
                <p className="text-sm text-muted-foreground">
                  When disabled, journal entries can only be reversed (not deleted). This provides a better audit trail and prevents accidental data loss.
                </p>
                <div className="text-xs text-muted-foreground">
                  <div>• Default: Disabled (entries can only be reversed)</div>
                  <div>• When enabled: Delete button appears on journal entry details</div>
                </div>
              </div>
              <Switch
                checked={currentCompany?.allow_journal_entry_deletion || false}
                onCheckedChange={async (checked) => {
                  try {
                    const { error } = await supabase
                      .from('companies')
                      .update({ allow_journal_entry_deletion: checked })
                      .eq('id', currentCompany?.id);

                    if (error) throw error;

                    await refreshCompanies();
                    
                    toast({
                      title: "Setting updated",
                      description: checked 
                        ? "Journal entries can now be deleted."
                        : "Journal entries can only be reversed (provides better audit trail).",
                    });
                  } catch (error) {
                    console.error('Error updating journal entry deletion setting:', error);
                    toast({
                      title: "Error",
                      description: "Failed to update setting",
                      variant: "destructive"
                    });
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Access Requests Card - Only show for company admins */}

      {/* Access Requests Card - Only show for company admins */}
      {isCompanyAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Requests
            </CardTitle>
            <CardDescription>
              Review and approve requests to join this company
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyAccessApproval />
          </CardContent>
        </Card>
      )}

      {/* Users Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Company Users ({users.length})
            </div>
            {isCompanyAdmin && (
              <Button onClick={() => setShowAddUserDialog(true)} size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Manage users who have access to this company
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Access Granted</TableHead>
                {isCompanyAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isCompanyAdmin ? 4 : 3} className="text-center py-8">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isCompanyAdmin ? 4 : 3} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No users found for this company</p>
                      <p className="text-sm text-muted-foreground">Company admins will be automatically listed here</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((companyUser) => (
                  <TableRow 
                    key={companyUser.id}
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => {
                      navigate(`/settings/users/${companyUser.user_id}`, { state: { fromCompanyManagement: true } });
                    }}
                  >
                    <TableCell>
                       <div>
                         <p className="font-medium">
                           {companyUser.profile?.display_name || 
                            `${companyUser.profile?.first_name || ''} ${companyUser.profile?.last_name || ''}`.trim() ||
                            'Unknown User'}
                         </p>
                        <p className="text-sm text-muted-foreground">
                          User ID: {companyUser.user_id.substring(0, 8)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {companyUser.user_id === user?.id && '(You)'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          companyUser.role === 'admin' ? 'destructive' :
                          companyUser.role === 'controller' ? 'secondary' :
                          companyUser.role === 'project_manager' ? 'default' :
                          'outline'
                        }
                      >
                        <Badge 
                          variant={
                            companyUser.role === 'admin' ? 'destructive' :
                            companyUser.role === 'controller' ? 'secondary' :
                            companyUser.role === 'project_manager' ? 'default' :
                            'outline'
                          }
                        >
                          {companyUser.role === 'admin' ? 'Administrator' :
                           companyUser.role === 'controller' ? 'Controller' :
                           companyUser.role === 'project_manager' ? 'Project Manager' :
                           companyUser.role === 'view_only' ? 'View Only' :
                           companyUser.role === 'company_admin' ? 'Company Admin' :
                           'Employee'}
                        </Badge>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {new Date(companyUser.granted_at).toLocaleDateString()}
                      </p>
                    </TableCell>
                    {isCompanyAdmin && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {isOwnerOrAdmin && companyUser.user_id !== user?.id && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTargetUser(companyUser);
                                setDeleteConfirmName('');
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      </TabsContent>

      <TabsContent value="templates">
        <PdfTemplateSettings />
      </TabsContent>

      <TabsContent value="aia-templates">
        <AIAInvoiceTemplateSettings />
      </TabsContent>

      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User to Company</DialogTitle>
            <DialogDescription>
              Invite a user to join this company. They must already have an account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">User Email</Label>
              <Input
                id="email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="controller">Controller</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>Add User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Company Dialog */}
      <Dialog open={showCreateCompanyDialog} onOpenChange={setShowCreateCompanyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
            <DialogDescription>
              Set up a new company with basic information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new_name">Company Name *</Label>
                <Input
                  id="new_name"
                  value={newCompanyForm.name}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Acme Construction"
                  required
                />
              </div>
              <div>
                <Label htmlFor="new_display_name">Display Name</Label>
                <Input
                  id="new_display_name"
                  value={newCompanyForm.display_name}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="Acme"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new_address">Address</Label>
              <Input
                id="new_address"
                value={newCompanyForm.address}
                onChange={(e) => setNewCompanyForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main Street"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="new_city">City</Label>
                <Input
                  id="new_city"
                  value={newCompanyForm.city}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="New York"
                />
              </div>
              <div>
                <Label htmlFor="new_state">State</Label>
                <Input
                  id="new_state"
                  value={newCompanyForm.state}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="NY"
                />
              </div>
              <div>
                <Label htmlFor="new_zip">Zip Code</Label>
                <Input
                  id="new_zip"
                  value={newCompanyForm.zip_code}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, zip_code: e.target.value }))}
                  placeholder="10001"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new_phone">Phone</Label>
                <Input
                  id="new_phone"
                  value={newCompanyForm.phone}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="new_email">Email</Label>
                <Input
                  id="new_email"
                  type="email"
                  value={newCompanyForm.email}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="info@company.com"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new_website">Website</Label>
              <Input
                id="new_website"
                value={newCompanyForm.website}
                onChange={(e) => setNewCompanyForm(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://company.com"
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Enable Shared Vendor Database</Label>
                <p className="text-xs text-muted-foreground">
                  Share vendor contact information with other companies (jobs and invoices remain private)
                </p>
              </div>
              <Switch
                checked={newCompanyForm.enable_shared_vendor_database}
                onCheckedChange={(checked) => setNewCompanyForm(prev => ({ 
                  ...prev, 
                  enable_shared_vendor_database: checked 
                }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCompanyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCompany}
              disabled={!newCompanyForm.name.trim()}
            >
              Create Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={showEditCompanyDialog} onOpenChange={setShowEditCompanyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Company Information</DialogTitle>
            <DialogDescription>
              Update your company's basic information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={companyForm.display_name}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, display_name: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={companyForm.address}
                onChange={(e) => setCompanyForm(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={companyForm.city}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={companyForm.state}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="zip">Zip Code</Label>
                <Input
                  id="zip"
                  value={companyForm.zip_code}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, zip_code: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={companyForm.website}
                onChange={(e) => setCompanyForm(prev => ({ ...prev, website: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Enable Shared Vendor Database</Label>
                <p className="text-xs text-muted-foreground">
                  Share vendor contact information with other companies (jobs and invoices remain private)
                </p>
              </div>
              <Switch
                checked={companyForm.enable_shared_vendor_database}
                onCheckedChange={(checked) => setCompanyForm(prev => ({ 
                  ...prev, 
                  enable_shared_vendor_database: checked 
                }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCompanyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCompany}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Remove User from Company
            </DialogTitle>
            <DialogDescription>
              This is a permanent action. The user will lose all access to this company's data, jobs, and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
              <p className="text-sm font-medium mb-2">
                To confirm, type the user's name: <strong>{
                  deleteTargetUser?.profile?.display_name ||
                  `${deleteTargetUser?.profile?.first_name || ''} ${deleteTargetUser?.profile?.last_name || ''}`.trim() ||
                  'Unknown User'
                }</strong>
              </p>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Type the user's name to confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleteConfirmName.toLowerCase().trim() !== (
                  deleteTargetUser?.profile?.display_name ||
                  `${deleteTargetUser?.profile?.first_name || ''} ${deleteTargetUser?.profile?.last_name || ''}`.trim() ||
                  ''
                ).toLowerCase().trim()
              }
              onClick={() => {
                if (deleteTargetUser) {
                  handleRemoveUser(deleteTargetUser.user_id);
                  setShowDeleteDialog(false);
                  setDeleteTargetUser(null);
                  setDeleteConfirmName('');
                }
              }}
            >
              Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
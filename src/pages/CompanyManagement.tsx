import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Users, UserPlus, Shield, Eye, Trash2, Edit, Plus, Upload, Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import CompanyAccessApproval from '@/components/CompanyAccessApproval';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
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
  const { toast } = useToast();
  const [users, setUsers] = useState<CompanyUser[]>([]);
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
    website: ''
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
    website: ''
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Get current user's role in this company
  const currentUserCompany = userCompanies.find(uc => uc.company_id === currentCompany?.id);
  const isCompanyAdmin = currentUserCompany?.role === 'admin' || currentUserCompany?.role === 'controller';

  const fetchCompanyUsers = async () => {
    if (!currentCompany) return;

    try {
      console.log('Fetching users for company:', currentCompany.id);
      
      // Use a manual approach to join user_company_access with profiles
      const { data: userAccessData, error: accessError } = await supabase
        .from('user_company_access')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      console.log('User access data:', userAccessData, 'error:', accessError);

      if (accessError) throw accessError;

      if (!userAccessData || userAccessData.length === 0) {
        console.log('No user access data found');
        setUsers([]);
        return;
      }

      // Get user IDs to fetch profiles
      const userIds = userAccessData.map(access => access.user_id);
      console.log('User IDs to fetch:', userIds);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name')
        .in('user_id', userIds);

      console.log('Profiles data:', profilesData, 'error:', profilesError);

      if (profilesError) throw profilesError;

      // Combine the data
      const combinedData = userAccessData.map(access => ({
        ...access,
        profile: profilesData?.find(profile => profile.user_id === access.user_id)
      }));

      console.log('Combined data:', combinedData);
      setUsers(combinedData);
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
      // Create the company
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          ...newCompanyForm,
          created_by: user.id
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
        website: ''
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
        website: currentCompany.website || ''
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
                  <TableRow key={companyUser.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {companyUser.profile?.display_name || 
                           `${companyUser.profile?.first_name || ''} ${companyUser.profile?.last_name || ''}`.trim() ||
                           'Unknown User'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {companyUser.user_id === user?.id && '(You)'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={companyUser.role === 'admin' ? 'default' : 'outline'} className="capitalize">
                        {companyUser.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(companyUser.granted_at).toLocaleDateString()}
                    </TableCell>
                    {isCompanyAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {companyUser.user_id !== user?.id && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveUser(companyUser.user_id)}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCompanyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCompany}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
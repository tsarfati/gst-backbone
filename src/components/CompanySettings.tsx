import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, MapPin, Upload, X, Building2 } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BillApprovalSettings from "@/components/BillApprovalSettings";

interface PickupLocation {
  id: string;
  name: string;
  address: string;
  contactPerson?: string;
  phone?: string;
}

export default function CompanySettings() {
  const { settings, updateSettings } = useSettings();
  const { currentCompany, refreshCompanies } = useCompany();
  const { toast } = useToast();
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<PickupLocation | null>(null);
  const [locationForm, setLocationForm] = useState<Omit<PickupLocation, 'id'>>({
    name: '',
    address: '',
    contactPerson: '',
    phone: ''
  });
  const [uploadingLogo, setUploadingLogo] = useState<'company' | 'header' | null>(null);

  const pickupLocations = settings.companySettings?.checkPickupLocations || [];

  const handleLogoUpload = (type: 'company' | 'header') => async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploadingLogo(type);

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}/${type}-logo-${Date.now()}.${fileExt}`;
      
      // Upload to company-logos bucket
      const { data, error } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file);

      if (error) throw error;

      // Get the storage path (not full URL)
      const logoPath = `company-logos/${fileName}`;

      if (type === 'company') {
        // Update company record with logo path
        const { error: updateError } = await supabase
          .from('companies')
          .update({ logo_url: logoPath })
          .eq('id', currentCompany.id);

        if (updateError) throw updateError;

        // Refresh company data to show new logo
        await refreshCompanies();
      } else {
        // Update settings with the public URL for header logo
        const { data: { publicUrl } } = supabase.storage
          .from('company-logos')
          .getPublicUrl(fileName);

        updateSettings({
          headerLogo: publicUrl
        });
      }

      toast({
        title: "Logo uploaded successfully",
        description: `Your ${type} logo has been saved`,
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploadingLogo(null);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleRemoveLogo = async (type: 'company' | 'header') => {
    if (type === 'company' && currentCompany) {
      try {
        // Remove logo from company record
        const { error } = await supabase
          .from('companies')
          .update({ logo_url: null })
          .eq('id', currentCompany.id);

        if (error) throw error;

        // If it's a storage path, delete the file
        if (currentCompany.logo_url && currentCompany.logo_url.includes('company-logos/')) {
          const fileName = currentCompany.logo_url.replace('company-logos/', '');
          await supabase.storage
            .from('company-logos')
            .remove([fileName]);
        }

        await refreshCompanies();
      } catch (error) {
        console.error('Error removing company logo:', error);
        toast({
          title: "Failed to remove logo",
          description: "Please try again.",
          variant: "destructive"
        });
        return;
      }
    } else {
      // Handle header logo (still uses settings)
      const logoUrl = settings.headerLogo;
      
      if (logoUrl?.includes('supabase')) {
        try {
          const urlParts = logoUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];
          
          await supabase.storage
            .from('company-logos')
            .remove([fileName]);
        } catch (error) {
          console.error('Error deleting logo file:', error);
        }
      }

      updateSettings({
        headerLogo: undefined
      });
    }

    toast({
      title: "Logo removed",
      description: `Your ${type} logo has been removed`,
    });
  };

  const handleAddLocation = () => {
    setEditingLocation(null);
    setLocationForm({ name: '', address: '', contactPerson: '', phone: '' });
    setIsLocationDialogOpen(true);
  };

  const handleEditLocation = (location: PickupLocation) => {
    setEditingLocation(location);
    setLocationForm({
      name: location.name,
      address: location.address,
      contactPerson: location.contactPerson || '',
      phone: location.phone || ''
    });
    setIsLocationDialogOpen(true);
  };

  const handleSaveLocation = () => {
    const currentLocations = pickupLocations || [];
    let updatedLocations;

    if (editingLocation) {
      // Update existing location
      updatedLocations = currentLocations.map(loc => 
        loc.id === editingLocation.id 
          ? { ...editingLocation, ...locationForm }
          : loc
      );
    } else {
      // Add new location
      const newLocation: PickupLocation = {
        id: Date.now().toString(),
        ...locationForm
      };
      updatedLocations = [...currentLocations, newLocation];
    }

    updateSettings({
      companySettings: {
        ...settings.companySettings,
        checkPickupLocations: updatedLocations
      }
    });

    setIsLocationDialogOpen(false);
  };

  const handleDeleteLocation = (locationId: string) => {
    const updatedLocations = pickupLocations.filter(loc => loc.id !== locationId);
    updateSettings({
      companySettings: {
        ...settings.companySettings,
        checkPickupLocations: updatedLocations
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Logo Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Company Logo</Label>
            <p className="text-sm text-muted-foreground">
              Upload your company logo for general use throughout the application
            </p>
            {currentCompany?.logo_url ? (
              <div className="flex items-center gap-4">
                <img 
                  src={currentCompany.logo_url.includes('http') 
                    ? currentCompany.logo_url 
                    : supabase.storage.from('company-logos').getPublicUrl(currentCompany.logo_url.replace('company-logos/', '')).data.publicUrl
                  } 
                  alt="Company Logo" 
                  className="h-16 w-auto border rounded-md"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveLogo('company')}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                <div className="flex flex-col items-center gap-2">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No company logo uploaded</p>
                  <Label htmlFor="company-logo-upload" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild disabled={uploadingLogo === 'company'}>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingLogo === 'company' ? 'Uploading...' : 'Upload Logo'}
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="company-logo-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleLogoUpload('company')}
                    disabled={uploadingLogo === 'company'}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Header Logo Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Header Logo</Label>
            <p className="text-sm text-muted-foreground">
              Upload a logo specifically for PDF exports and document headers
            </p>
            {settings.headerLogo ? (
              <div className="flex items-center gap-4">
                <img 
                  src={settings.headerLogo} 
                  alt="Header Logo" 
                  className="h-16 w-auto border rounded-md"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveLogo('header')}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                <div className="flex flex-col items-center gap-2">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No header logo uploaded</p>
                  <Label htmlFor="header-logo-upload" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild disabled={uploadingLogo === 'header'}>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingLogo === 'header' ? 'Uploading...' : 'Upload Logo'}
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="header-logo-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleLogoUpload('header')}
                    disabled={uploadingLogo === 'header'}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Check Pickup Locations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Manage office locations where vendors can pick up checks
            </p>
            <Button onClick={handleAddLocation} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </div>

          {pickupLocations.length > 0 ? (
            <div className="space-y-3">
              {pickupLocations.map((location) => (
                <Card key={location.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{location.name}</div>
                          <div className="text-sm text-muted-foreground">{location.address}</div>
                          {location.contactPerson && (
                            <div className="text-sm text-muted-foreground">
                              Contact: {location.contactPerson}
                              {location.phone && ` • ${location.phone}`}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditLocation(location)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Pickup Location</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{location.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteLocation(location.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pickup locations configured</p>
              <Button variant="outline" onClick={handleAddLocation} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add First Location
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job & Bill Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <BillApprovalSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Journal Entry Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow-journal-deletion">Allow Journal Entry Deletion</Label>
              <p className="text-sm text-muted-foreground">
                When disabled, journal entries can only be reversed (not deleted). This provides better audit trail.
              </p>
            </div>
            <Switch
              id="allow-journal-deletion"
              checked={currentCompany?.allow_journal_entry_deletion || false}
              onCheckedChange={async (checked) => {
                if (!currentCompany) return;
                
                const { error } = await supabase
                  .from('companies')
                  .update({ allow_journal_entry_deletion: checked })
                  .eq('id', currentCompany.id);

                if (error) {
                  toast({
                    title: "Error updating setting",
                    description: error.message,
                    variant: "destructive"
                  });
                } else {
                  await refreshCompanies();
                  toast({
                    title: "Setting updated",
                    description: `Journal entries can now be ${checked ? 'deleted' : 'only reversed'}`,
                  });
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? 'Edit Pickup Location' : 'Add Pickup Location'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Location Name</Label>
              <Input
                id="name"
                value={locationForm.name}
                onChange={(e) => setLocationForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Main Office, Warehouse"
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={locationForm.address}
                onChange={(e) => setLocationForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Full address including city, state, zip"
              />
            </div>

            <div>
              <Label htmlFor="contactPerson">Contact Person (Optional)</Label>
              <Input
                id="contactPerson"
                value={locationForm.contactPerson}
                onChange={(e) => setLocationForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                placeholder="Name of contact person"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input
                id="phone"
                value={locationForm.phone}
                onChange={(e) => setLocationForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLocationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLocation}>
              {editingLocation ? 'Save Changes' : 'Add Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
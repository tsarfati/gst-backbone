import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, MapPin } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";

interface PickupLocation {
  id: string;
  name: string;
  address: string;
  contactPerson?: string;
  phone?: string;
}

export default function CompanySettings() {
  const { settings, updateSettings } = useSettings();
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<PickupLocation | null>(null);
  const [locationForm, setLocationForm] = useState<Omit<PickupLocation, 'id'>>({
    name: '',
    address: '',
    contactPerson: '',
    phone: ''
  });

  const pickupLocations = settings.companySettings?.checkPickupLocations || [];

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
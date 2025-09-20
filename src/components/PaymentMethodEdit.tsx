import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";

interface PaymentMethod {
  id?: string;
  type: string;
  accountNumber: string;
  routingNumber?: string;
  bankName?: string;
  isDefault: boolean;
  checkDelivery?: string;
  pickupLocation?: string;
}

interface PaymentMethodEditProps {
  paymentMethod: PaymentMethod | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (method: PaymentMethod) => void;
  onDelete?: (methodId: string) => void;
  userRole?: 'admin' | 'controller' | 'user';
}

export default function PaymentMethodEdit({
  paymentMethod,
  isOpen,
  onClose,
  onSave,
  onDelete,
  userRole = 'user'
}) {
  const { settings } = useSettings();
  const [formData, setFormData] = useState<PaymentMethod>(() => paymentMethod || {
    type: 'ACH',
    accountNumber: '',
    routingNumber: '',
    bankName: '',
    isDefault: false,
    checkDelivery: 'mail',
    pickupLocation: ''
  });
  
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showConfirmAccountNumber, setShowConfirmAccountNumber] = useState(false);

  const canViewSensitiveData = userRole === 'admin' || userRole === 'controller';
  const isEditing = !!paymentMethod?.id;

  const maskAccountNumber = (accountNumber: string) => {
    if (accountNumber.length <= 4) return accountNumber;
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!isEditing && formData.accountNumber !== confirmAccountNumber) {
      alert('Account numbers do not match');
      return;
    }
    onSave(formData);
    onClose();
  };

  const handleDelete = () => {
    if (paymentMethod?.id && onDelete) {
      onDelete(paymentMethod.id);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Payment Method' : 'Add Payment Method'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="type">Payment Type</Label>
            <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACH">ACH</SelectItem>
                <SelectItem value="Wire">Wire Transfer</SelectItem>
                <SelectItem value="Check">Check</SelectItem>
                <SelectItem value="Credit Card">Credit Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formData.type === 'ACH' || formData.type === 'Wire') && (
            <>
              <div>
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="routingNumber">Routing Number</Label>
                <Input
                  id="routingNumber"
                  value={formData.routingNumber}
                  onChange={(e) => handleInputChange('routingNumber', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="accountNumber">Account Number</Label>
                <div className="relative">
                  <Input
                    id="accountNumber"
                    type={showAccountNumber ? 'text' : 'password'}
                    value={isEditing && !showAccountNumber ? maskAccountNumber(formData.accountNumber) : formData.accountNumber}
                    onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                    disabled={isEditing && !showAccountNumber && !canViewSensitiveData}
                  />
                  {canViewSensitiveData && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowAccountNumber(!showAccountNumber)}
                    >
                      {showAccountNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>

              {!isEditing && (
                <div>
                  <Label htmlFor="confirmAccountNumber">Confirm Account Number</Label>
                  <div className="relative">
                    <Input
                      id="confirmAccountNumber"
                      type={showConfirmAccountNumber ? 'text' : 'password'}
                      value={confirmAccountNumber}
                      onChange={(e) => setConfirmAccountNumber(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowConfirmAccountNumber(!showConfirmAccountNumber)}
                    >
                      {showConfirmAccountNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {formData.type === 'Check' && (
            <>
              <div>
                <Label htmlFor="checkDelivery">Check Delivery</Label>
                <Select value={formData.checkDelivery} onValueChange={(value) => handleInputChange('checkDelivery', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mail">Mail</SelectItem>
                    <SelectItem value="office_pickup">Office Pickup</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.checkDelivery === 'office_pickup' && (
                <div>
                  <Label htmlFor="pickupLocation">Pickup Location</Label>
                  <Select value={formData.pickupLocation} onValueChange={(value) => handleInputChange('pickupLocation', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pickup location" />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.companySettings?.checkPickupLocations?.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name} - {location.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {formData.type === 'Credit Card' && (
            <div>
              <Label htmlFor="accountNumber">Card Number</Label>
              <div className="relative">
                <Input
                  id="accountNumber"
                  type={showAccountNumber ? 'text' : 'password'}
                  value={isEditing && !showAccountNumber ? maskAccountNumber(formData.accountNumber) : formData.accountNumber}
                  onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                  disabled={isEditing && !showAccountNumber && !canViewSensitiveData}
                />
                {canViewSensitiveData && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowAccountNumber(!showAccountNumber)}
                  >
                    {showAccountNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {isEditing && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this payment method? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEditing ? 'Save Changes' : 'Add Payment Method'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
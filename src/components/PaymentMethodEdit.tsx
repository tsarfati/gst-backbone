import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Eye, EyeOff, Trash2, Upload, FileText, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";

interface PaymentMethod {
  id?: string;
  type: string;
  account_number: string;
  routing_number?: string;
  bank_name?: string;
  is_primary: boolean;
  check_delivery?: string;
  pickup_location?: string;
  voided_check_url?: string;
  website_address?: string;
  login_information?: string;
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
  const { profile } = useAuth();
  const [formData, setFormData] = useState<PaymentMethod>(() => paymentMethod || {
    type: 'ach',
    account_number: '',
    routing_number: '',
    bank_name: '',
    is_primary: false,
    check_delivery: 'mail',
    pickup_location: '',
    voided_check_url: '',
    website_address: '',
    login_information: ''
  });
  
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showConfirmAccountNumber, setShowConfirmAccountNumber] = useState(false);
  const [showRoutingNumber, setShowRoutingNumber] = useState(false);
  const [voidedCheckFile, setVoidedCheckFile] = useState<File | null>(null);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [editField, setEditField] = useState<'account' | 'routing' | null>(null);
  const [allowAccountEdit, setAllowAccountEdit] = useState(false);
  const [allowRoutingEdit, setAllowRoutingEdit] = useState(false);
 
  const canViewSensitiveData = profile?.role === 'admin' || profile?.role === 'controller';
  const isEditing = !!paymentMethod?.id;

  const maskAccountNumber = (accountNumber: string) => {
    if (accountNumber.length <= 4) return accountNumber;
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAccountNumberEdit = () => {
    if (isEditing) {
      setEditField('account');
      setShowEditConfirm(true);
    } else {
      setShowAccountNumber(true);
    }
  };

  const handleRoutingNumberEdit = () => {
    if (isEditing) {
      setEditField('routing');
      setShowEditConfirm(true);
    } else {
      setShowRoutingNumber(true);
    }
  };
 
  const handleVoidedCheckUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVoidedCheckFile(file);
      // In a real app, you'd upload this to Supabase storage
      // For now, we'll just store the file name
      handleInputChange('voided_check_url', `uploads/voided-checks/${file.name}`);
    }
  };

  const handleSave = () => {
    if ((formData.type === 'ACH' || formData.type === 'Wire') && !isEditing && formData.account_number !== confirmAccountNumber) {
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
      <DialogContent className="sm:max-w-md" aria-describedby="payment-method-description">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Payment Method' : 'Add Payment Method'}
          </DialogTitle>
          <DialogDescription>
            Manage vendor payment details. Sensitive fields are masked and encrypted.
          </DialogDescription>
        </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="type">Payment Type</Label>
              <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="ach">ACH</SelectItem>
                <SelectItem value="wire">Wire Transfer</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
              </SelectContent>
              </Select>
            </div>

          {(formData.type === 'ach' || formData.type === 'wire') && (
            <>
              <div className="rounded-lg border border-accent bg-accent/10 p-4 space-y-4">
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Sensitive information</AlertTitle>
                  <AlertDescription>
                    Bank details are encrypted at rest. Only admins and controllers can unmask on screen.
                  </AlertDescription>
                </Alert>

                <div>
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={formData.bank_name}
                    onChange={(e) => handleInputChange('bank_name', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="routingNumber">Routing Number</Label>
                  <div className="relative">
                    <NumericInput
                      id="routingNumber"
                      value={formData.routing_number || ''}
                      onChange={(value) => handleInputChange('routing_number', value)}
                      placeholder="9 digit routing number"
                      masked={true}
                      showMasked={showRoutingNumber}
                      canToggleMask={canViewSensitiveData}
                      onToggleMask={setShowRoutingNumber}
                      onClick={isEditing ? handleRoutingNumberEdit : undefined}
                      readOnly={isEditing && !allowRoutingEdit}
                    />
                    {isEditing && !allowRoutingEdit && (
                      <div className="absolute inset-0 bg-muted/50 rounded-md flex items-center justify-center cursor-pointer" onClick={handleRoutingNumberEdit}>
                        <span className="text-muted-foreground text-sm">Click to edit</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <div className="relative">
                    <NumericInput
                      id="accountNumber"
                      value={formData.account_number || ''}
                      onChange={(value) => handleInputChange('account_number', value)}
                      placeholder="Account number"
                      masked={true}
                      showMasked={showAccountNumber}
                      canToggleMask={canViewSensitiveData}
                      onToggleMask={setShowAccountNumber}
                      onClick={isEditing ? handleAccountNumberEdit : undefined}
                      readOnly={isEditing && !allowAccountEdit}
                    />
                    {isEditing && !allowAccountEdit && (
                      <div className="absolute inset-0 bg-muted/50 rounded-md flex items-center justify-center cursor-pointer" onClick={handleAccountNumberEdit}>
                        <span className="text-muted-foreground text-sm">Click to edit</span>
                      </div>
                    )}
                  </div>
                </div>

                {!isEditing && (
                  <div>
                    <Label htmlFor="confirmAccountNumber">Confirm Account Number</Label>
                    <NumericInput
                      id="confirmAccountNumber"
                      value={confirmAccountNumber}
                      onChange={setConfirmAccountNumber}
                      placeholder="Re-enter account number"
                      masked={true}
                      showMasked={showConfirmAccountNumber}
                      canToggleMask={canViewSensitiveData}
                      onToggleMask={setShowConfirmAccountNumber}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="voidedCheck">Voided Check Upload</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        id="voidedCheck"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleVoidedCheckUpload}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                    </div>
                    {formData.voided_check_url && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>Voided check uploaded</span>
                        {canViewSensitiveData && (
                          <Button variant="ghost" size="sm" className="h-6 px-2">
                            View
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {formData.type === 'check' && (
            <>
              <div>
                <Label htmlFor="checkDelivery">Check Delivery</Label>
                <Select value={formData.check_delivery} onValueChange={(value) => handleInputChange('check_delivery', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mail">Mail</SelectItem>
                    <SelectItem value="office_pickup">Office Pickup</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.check_delivery === 'office_pickup' && (
                <div>
                  <Label htmlFor="pickupLocation">Pickup Location</Label>
                  <Select value={formData.pickup_location} onValueChange={(value) => handleInputChange('pickup_location', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select office location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main_office">Main Office</SelectItem>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                      <SelectItem value="construction_site">Construction Site</SelectItem>
                      <SelectItem value="regional_office">Regional Office</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {formData.type === 'credit_card' && (
            <div>
              <Label htmlFor="accountNumber">Card Number</Label>
              <NumericInput
                id="accountNumber"
                value={formData.account_number || ''}
                onChange={(value) => handleInputChange('account_number', value)}
                placeholder="Card number"
                masked={true}
                showMasked={showAccountNumber}
                onClick={isEditing ? handleAccountNumberEdit : undefined}
                readOnly={isEditing && !showAccountNumber}
              />
            </div>
          )}

          {formData.type === 'Vendor Payment Portal' && (
            <>
              <div>
                <Label htmlFor="websiteAddress">Website Address</Label>
                <Input
                  id="websiteAddress"
                  value={formData.website_address}
                  onChange={(e) => handleInputChange('website_address', e.target.value)}
                  placeholder="https://vendor-portal.com"
                />
              </div>

              <div>
                <Label htmlFor="loginInformation">Login Information</Label>
                <Input
                  id="loginInformation"
                  value={formData.login_information}
                  onChange={(e) => handleInputChange('login_information', e.target.value)}
                  placeholder="Username or login details"
                />
              </div>
            </>
          )}
        </div>

        {/* Edit Sensitive Field Confirmation Dialog */}
        <AlertDialog open={showEditConfirm} onOpenChange={setShowEditConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {editField === 'routing' ? 'Edit Routing Number' : 'Edit Account Number'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                You are about to edit sensitive financial information. Proceed only if you intend to change the {editField === 'routing' ? 'routing number' : 'account number'}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (editField === 'routing') {
                  setAllowRoutingEdit(true);
                  setShowRoutingNumber(true);
                } else {
                  setAllowAccountEdit(true);
                  setShowAccountNumber(true);
                }
                setShowEditConfirm(false);
                setEditField(null);
              }}>
                Yes, Edit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
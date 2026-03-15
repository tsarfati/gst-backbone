 import { useEffect, useState } from 'react';
 import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { useToast } from '@/hooks/use-toast';
 import { useCompany } from '@/contexts/CompanyContext';
 import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
 import { supabase } from '@/integrations/supabase/client';
import { resolveCompanyLogoUrl } from '@/utils/resolveCompanyLogoUrl';
import { Mail, UserPlus, Loader2 } from 'lucide-react';
 
 interface AddSystemUserDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onUserAdded: () => void;
 }
 
 export default function AddSystemUserDialog({ open, onOpenChange, onUserAdded }: AddSystemUserDialogProps) {
  interface CustomRole {
    id: string;
    role_name: string;
    role_key: string;
    is_active?: boolean;
  }

  const SYSTEM_ROLE_OPTIONS = [
    { value: 'admin', label: 'Administrator' },
    { value: 'controller', label: 'Controller' },
    { value: 'project_manager', label: 'Project Manager' },
    { value: 'employee', label: 'Employee' },
    { value: 'view_only', label: 'View Only' },
  ] as const;

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(false);
   const { toast } = useToast();
   const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { settings } = useSettings();

  useEffect(() => {
    const loadCustomRoles = async () => {
      if (!currentCompany?.id || !open) return;
      try {
        const { data, error } = await supabase
          .from('custom_roles')
          .select('id, role_name, role_key, is_active')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true)
          .order('role_name');

        if (error) throw error;
        setCustomRoles((data as CustomRole[]) || []);
      } catch (error) {
        console.error('Error loading custom roles for invite dialog:', error);
        setCustomRoles([]);
      }
    };

    loadCustomRoles();
  }, [currentCompany?.id, open]);
 
  const resetForm = () => {
    setEmail('');
    setRole('employee');
  };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (!email || !currentCompany || !user) {
       toast({
         title: 'Error',
         description: 'Email is required',
         variant: 'destructive',
       });
       return;
     }
 
     setLoading(true);
 
     try {
       // Email clients can only render publicly reachable image URLs.
       // Normalize any stored storage paths (e.g. "company-logos/...jpg") to a public URL.
       const companyLogoRaw = settings.customLogo || settings.headerLogo || currentCompany.logo_url;
       const companyLogo = resolveCompanyLogoUrl(companyLogoRaw);
      
      // Get the primary color from settings
      const primaryColor = settings.customColors?.primary;

      const selectedCustomRole = role.startsWith('custom_')
        ? customRoles.find((r) => r.id === role.replace('custom_', ''))
        : null;
      const fallbackSystemRole = selectedCustomRole ? 'employee' : role;

      // Call edge function to send invitation email
       const { data, error } = await supabase.functions.invoke('send-user-invite', {
         body: {
           email,
           role: fallbackSystemRole,
           customRoleId: selectedCustomRole?.id,
           customRoleName: selectedCustomRole?.role_name,
           companyId: currentCompany.id,
           companyName: currentCompany.display_name || currentCompany.name,
          companyLogo,
          primaryColor,
           invitedBy: user.id,
         },
       });
 
       if (error) throw error;
 
       toast({
         title: 'Invitation Sent',
         description: `An invitation email has been sent to ${email}`,
       });
 
       resetForm();
       onOpenChange(false);
       onUserAdded();
     } catch (error: any) {
       console.error('Error sending invitation:', error);
       toast({
         title: 'Error',
         description: error.message || 'Failed to send invitation',
         variant: 'destructive',
       });
     } finally {
       setLoading(false);
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-[425px]">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <UserPlus className="h-5 w-5" />
             Add System User
           </DialogTitle>
          <DialogDescription>
             Send an invitation by email and assign the role. The user will complete their name during account setup.
          </DialogDescription>
        </DialogHeader>
 
         <form onSubmit={handleSubmit} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="email">Email Address *</Label>
             <div className="relative">
               <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                 id="email"
                 type="email"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 placeholder="user@company.com"
                 className="pl-10"
                 required
               />
             </div>
           </div>
 
          <div className="space-y-2">
             <Label htmlFor="role">Role *</Label>
             <Select value={role} onValueChange={setRole}>
               <SelectTrigger>
                 <SelectValue />
               </SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                  {customRoles.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        Custom Roles
                      </div>
                      {customRoles.map((customRole) => (
                        <SelectItem
                          key={customRole.id}
                          value={`custom_${customRole.id}`}
                        >
                          {customRole.role_name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {customRoles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Custom-role invites are created with an employee base role and your custom role will be applied automatically after invite acceptance.
                </p>
              )}
           </div>
 
           <div className="flex gap-3 pt-4">
             <Button type="submit" disabled={loading || !email} className="flex-1">
               {loading ? (
                 <>
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                   Sending...
                 </>
               ) : (
                 <>
                   <Mail className="h-4 w-4 mr-2" />
                   Send Invitation
                 </>
               )}
             </Button>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
           </div>
         </form>
       </DialogContent>
     </Dialog>
   );
 }

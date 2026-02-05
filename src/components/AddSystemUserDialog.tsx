 import { useState } from 'react';
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
 import { Mail, UserPlus, Loader2 } from 'lucide-react';
 
 interface AddSystemUserDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onUserAdded: () => void;
 }
 
 export default function AddSystemUserDialog({ open, onOpenChange, onUserAdded }: AddSystemUserDialogProps) {
   const [email, setEmail] = useState('');
   const [firstName, setFirstName] = useState('');
   const [lastName, setLastName] = useState('');
   const [role, setRole] = useState('employee');
   const [loading, setLoading] = useState(false);
   const { toast } = useToast();
   const { currentCompany } = useCompany();
   const { user } = useAuth();
  const { settings } = useSettings();
 
   const resetForm = () => {
     setEmail('');
     setFirstName('');
     setLastName('');
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
      // Use the company's custom logo from settings, or fall back to company.logo_url
      const companyLogo = settings.customLogo || settings.headerLogo || currentCompany.logo_url;
      
      // Get the primary color from settings
      const primaryColor = settings.customColors?.primary;

       // Call edge function to send invitation email
       const { data, error } = await supabase.functions.invoke('send-user-invite', {
         body: {
           email,
           firstName,
           lastName,
           role,
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
             Send an email invitation to add a new user with full system access.
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
 
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label htmlFor="firstName">First Name</Label>
               <Input
                 id="firstName"
                 value={firstName}
                 onChange={(e) => setFirstName(e.target.value)}
                 placeholder="John"
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="lastName">Last Name</Label>
               <Input
                 id="lastName"
                 value={lastName}
                 onChange={(e) => setLastName(e.target.value)}
                 placeholder="Doe"
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
                 <SelectItem value="admin">Administrator</SelectItem>
                 <SelectItem value="controller">Controller</SelectItem>
                 <SelectItem value="project_manager">Project Manager</SelectItem>
                 <SelectItem value="employee">Employee</SelectItem>
                 <SelectItem value="view_only">View Only</SelectItem>
               </SelectContent>
             </Select>
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
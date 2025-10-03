import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Clock, User, Mail, Phone, MessageSquare, FileText, ArrowLeft, Send, Edit2 } from 'lucide-react';
import { usePunchClockAuth } from '@/contexts/PunchClockAuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import AvatarUploader from '@/components/AvatarUploader';

interface TimeCard {
  id: string;
  punch_in_time: string;
  punch_out_time: string;
  total_hours: number;
  status: string;
  job_id: string;
  cost_code_id?: string;
}

interface ChangeRequest {
  id: string;
  time_card_id: string;
  reason: string;
  status: string;
  requested_at: string;
  reviewed_at?: string;
  review_notes?: string;
  proposed_punch_in_time?: string;
  proposed_punch_out_time?: string;
  proposed_job_id?: string;
  proposed_cost_code_id?: string;
}

export default function EmployeeDashboard() {
  const { user, profile, signOut } = usePunchClockAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isPinUser = (user as any)?.is_pin_employee;
  
  const [timeCards, setTimeCards] = useState<TimeCard[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeCard, setSelectedTimeCard] = useState<TimeCard | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [companyPolicies, setCompanyPolicies] = useState<string>('');
  
  // Change request form data
  const [changeRequestData, setChangeRequestData] = useState({
    proposed_punch_in_time: '',
    proposed_punch_out_time: '',
    proposed_job_id: '',
    proposed_cost_code_id: ''
  });
  
  const [allJobs, setAllJobs] = useState<Array<{id: string, name: string}>>([]);
  const [allCostCodes, setAllCostCodes] = useState<Array<{id: string, code: string, description: string}>>([]);
  
  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    email: '',
    phone: '',
    avatar_url: ''
  });
  
  const [latestPunchPhoto, setLatestPunchPhoto] = useState<string | null>(null);
  
  // Messaging
  const [message, setMessage] = useState('');
  const [projectManagers, setProjectManagers] = useState<Array<{id: string, name: string, jobName: string}>>([]);
  
  // Company Contacts
  const [companyContacts, setCompanyContacts] = useState<Array<{
    id: string;
    name: string;
    title: string;
    email?: string;
    phone?: string;
    department?: string;
  }>>([]);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const userId = (user as any).user_id || (user as any).id;
      
      // Load time cards - filter out deleted ones
      const { data: timeCardsData } = await supabase
        .from('time_cards')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'deleted')
        .order('punch_in_time', { ascending: false })
        .limit(50);
      
      setTimeCards(timeCardsData || []);
      
      // Load change requests
      const { data: requestsData } = await supabase
        .from('time_card_change_requests')
        .select('*')
        .eq('user_id', userId)
        .order('requested_at', { ascending: false });
      
      setChangeRequests(requestsData || []);
      
      // Load profile/avatar
      setProfileData(prev => ({
        ...prev,
        avatar_url: profile?.avatar_url || ''
      }));
      
      // For PIN employees, load phone from pin_employees (email optional)
      if (isPinUser) {
        const { data: pinData } = await supabase
          .from('pin_employees')
          .select('phone, avatar_url')
          .eq('id', userId)
          .maybeSingle();
        if (pinData) {
          setProfileData(prev => ({
            ...prev,
            phone: (pinData as any).phone || '',
            avatar_url: (pinData as any).avatar_url || prev.avatar_url
          }));
        }
      } else {
        // For regular users, load email from auth.users
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          setProfileData(prev => ({
            ...prev,
            email: authUser.email || ''
          }));
        }
      }
      
      // Get latest punch photo for avatar fallback
      const { data: latestPunch } = await supabase
        .from('time_cards')
        .select('punch_out_photo_url, punch_in_photo_url')
        .eq('user_id', userId)
        .order('punch_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestPunch) {
        setLatestPunchPhoto(latestPunch.punch_out_photo_url || latestPunch.punch_in_photo_url);
      }
      
      // Load company policies
      const { data: settingsData } = await supabase
        .from('job_punch_clock_settings')
        .select('company_policies')
        .eq('job_id', '00000000-0000-0000-0000-000000000000')
        .maybeSingle();
      
      if (settingsData?.company_policies) {
        setCompanyPolicies(settingsData.company_policies);
      }
      
      // Find all project managers from all assigned jobs
      const { data: jobAssignment } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_jobs, assigned_cost_codes')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (jobAssignment?.assigned_jobs && jobAssignment.assigned_jobs.length > 0) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select(`
            id,
            name,
            project_manager_user_id,
            profiles!jobs_project_manager_user_id_fkey (
              user_id,
              display_name,
              first_name,
              last_name
            )
          `)
          .in('id', jobAssignment.assigned_jobs);
        
        if (jobsData) {
          // Store jobs for change request dialog
          setAllJobs(jobsData.map(j => ({ id: j.id, name: j.name })));
          
          const pms = jobsData
            .filter(job => job.project_manager_user_id && job.profiles)
            .map(job => ({
              id: job.project_manager_user_id,
              name: (job.profiles as any)?.display_name || 
                    `${(job.profiles as any)?.first_name || ''} ${(job.profiles as any)?.last_name || ''}`.trim(),
              jobName: job.name
            }));
          
          // Remove duplicates by PM id
          const uniquePMs = Array.from(
            new Map(pms.map(pm => [pm.id, pm])).values()
          );
          
          setProjectManagers(uniquePMs);
        }
      }
      
      // Load cost codes for change requests
      if (jobAssignment?.assigned_cost_codes && jobAssignment.assigned_cost_codes.length > 0) {
        const { data: costCodesData } = await supabase
          .from('cost_codes')
          .select('id, code, description')
          .in('id', jobAssignment.assigned_cost_codes)
          .eq('is_active', true);
        
        if (costCodesData) {
          setAllCostCodes(costCodesData);
        }
      }
      
      // Load PM/Admin contacts assigned to employee's jobs
      const { data: jobAssignments } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_jobs')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (jobAssignments?.assigned_jobs && jobAssignments.assigned_jobs.length > 0) {
        // Get job managers and assistant managers for assigned jobs
        const { data: jobManagers } = await supabase
          .from('jobs')
          .select(`
            project_manager_user_id,
            profiles!jobs_project_manager_user_id_fkey(
              user_id,
              display_name,
              first_name,
              last_name,
              role
            )
          `)
          .in('id', jobAssignments.assigned_jobs)
          .not('project_manager_user_id', 'is', null);
        
        const { data: assistantManagers } = await supabase
          .from('job_assistant_managers')
          .select(`
            user_id,
            profiles(
              user_id,
              display_name,
              first_name,
              last_name,
              role
            )
          `)
          .in('job_id', jobAssignments.assigned_jobs);
        
        // Combine and deduplicate contacts
        const contactMap = new Map();
        
        // Add project managers
        jobManagers?.forEach(jm => {
          if (jm.profiles) {
            const profile = jm.profiles as any;
            if (!contactMap.has(profile.user_id)) {
              contactMap.set(profile.user_id, {
                id: profile.user_id,
                name: profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
                title: profile.role || 'Project Manager',
                email: undefined,
                phone: undefined,
                department: profile.role
              });
            }
          }
        });
        
        // Add assistant managers (admins can also appear here)
        assistantManagers?.forEach(am => {
          if (am.profiles) {
            const profile = am.profiles as any;
            if (!contactMap.has(profile.user_id) && 
                (profile.role === 'admin' || profile.role === 'project_manager')) {
              contactMap.set(profile.user_id, {
                id: profile.user_id,
                name: profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
                title: profile.role || 'Manager',
                email: undefined,
                phone: undefined,
                department: profile.role
              });
            }
          }
        });
        
        // Get company admins
        const { data: companyAccessData } = await supabase
          .from('user_company_access')
          .select('company_id')
          .eq('user_id', userId)
          .eq('is_active', true);
        
        if (companyAccessData && companyAccessData.length > 0) {
          const userCompanies = companyAccessData.map(uca => uca.company_id);
          
          const { data: adminProfiles } = await supabase
            .from('user_company_access')
            .select(`
              user_id,
              role,
              profiles(
                user_id,
                display_name,
                first_name,
                last_name,
                role
              )
            `)
            .in('company_id', userCompanies)
            .eq('is_active', true)
            .or('role.eq.admin,role.eq.controller');
          
          adminProfiles?.forEach(ap => {
            if (ap.profiles) {
              const profile = ap.profiles as any;
              if (!contactMap.has(profile.user_id)) {
                contactMap.set(profile.user_id, {
                  id: profile.user_id,
                  name: profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
                  title: profile.role || 'Admin',
                  email: undefined,
                  phone: undefined,
                  department: profile.role
                });
              }
            }
          });
        }
        
        setCompanyContacts(Array.from(contactMap.values()));
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChange = async () => {
    if (!selectedTimeCard || !changeReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for the change request',
        variant: 'destructive'
      });
      return;
    }

    try {
      const userId = (user as any).user_id || (user as any).id;
      
      const { error } = await supabase
        .from('time_card_change_requests')
        .insert({
          time_card_id: selectedTimeCard.id,
          user_id: userId,
          reason: changeReason,
          status: 'pending',
          proposed_punch_in_time: changeRequestData.proposed_punch_in_time || null,
          proposed_punch_out_time: changeRequestData.proposed_punch_out_time || null,
          proposed_job_id: changeRequestData.proposed_job_id || null,
          proposed_cost_code_id: changeRequestData.proposed_cost_code_id || null
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Change request submitted successfully'
      });

      setShowChangeDialog(false);
      setChangeReason('');
      setSelectedTimeCard(null);
      setChangeRequestData({
        proposed_punch_in_time: '',
        proposed_punch_out_time: '',
        proposed_job_id: '',
        proposed_cost_code_id: ''
      });
      loadData();
    } catch (error) {
      console.error('Error submitting change request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit change request',
        variant: 'destructive'
      });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || projectManagers.length === 0) {
      toast({
        title: 'Error',
        description: projectManagers.length === 0 ? 'No project managers available' : 'Please enter a message',
        variant: 'destructive'
      });
      return;
    }

    try {
      const userId = (user as any).user_id || (user as any).id;
      
      // Send message to all project managers
      const messageInserts = projectManagers.map(pm => ({
        from_user_id: userId,
        to_user_id: pm.id,
        content: message,
        subject: 'Message from Employee',
        read: false
      }));
      
      const { error } = await supabase
        .from('messages')
        .insert(messageInserts);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Message sent to ${projectManagers.length} project manager(s)`
      });

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const userId = (user as any).user_id || (user as any).id;
      const isPinUser = (user as any).is_pin_employee;
      
      // Update the appropriate table based on user type
      if (isPinUser) {
        const { error } = await supabase
          .from('pin_employees')
          .update({
            email: profileData.email,
            phone: profileData.phone,
            avatar_url: profileData.avatar_url
          })
          .eq('id', userId);

        if (error) throw error;
      } else {
        // Update profile avatar
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            avatar_url: profileData.avatar_url
          })
          .eq('user_id', userId);

        if (profileError) throw profileError;

        // Update email via auth API if changed
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser && profileData.email !== authUser.email) {
          const { error: emailError } = await supabase.auth.updateUser({
            email: profileData.email
          });
          if (emailError) throw emailError;
        }
      }

      toast({
        title: 'Success',
        description: 'Profile updated successfully'
      });

      setEditingProfile(false);
      loadData();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive'
      });
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 sm:justify-between mb-4 sm:mb-6">
          <Button variant="ghost" onClick={() => navigate('/punch-clock-app')} className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Punch Clock
          </Button>
          <Button variant="outline" onClick={signOut} className="w-full sm:w-auto">
            Sign Out
          </Button>
        </div>

        <Card className="mb-4 sm:mb-6">
          <CardHeader className="p-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Avatar className="h-12 w-12 sm:h-16 sm:w-16">
                <AvatarImage src={profileData.avatar_url || latestPunchPhoto || undefined} />
                <AvatarFallback>{getInitials(profile?.display_name || profile?.first_name)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-base sm:text-xl">{profile?.display_name || `${profile?.first_name} ${profile?.last_name}`}</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">{profile?.role || 'Employee'}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="timecards" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1 h-auto">
            <TabsTrigger value="timecards" className="text-xs sm:text-sm py-2">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Time Cards</span>
              <span className="sm:hidden">Time</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs sm:text-sm py-2">
              <Edit2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Manual Entry</span>
              <span className="sm:hidden">Manual</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="text-xs sm:text-sm py-2">
              <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="messages" className="text-xs sm:text-sm py-2">
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Messages</span>
              <span className="sm:hidden">Msgs</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs sm:text-sm py-2">
              <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Contacts</span>
              <span className="sm:hidden">Contact</span>
            </TabsTrigger>
            <TabsTrigger value="policies" className="text-xs sm:text-sm py-2">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Policies</span>
              <span className="sm:hidden">Policy</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timecards" className="space-y-4">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base sm:text-xl">My Time Cards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {timeCards.filter(card => card.status !== 'deleted').length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No time cards yet</p>
                ) : (
                  timeCards.filter(card => card.status !== 'deleted').map((card) => (
                    <div key={card.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="font-medium text-sm sm:text-base">
                            {format(new Date(card.punch_in_time), 'MMM dd, yyyy')}
                          </span>
                          <Badge variant={card.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                            {card.status}
                          </Badge>
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          {format(new Date(card.punch_in_time), 'h:mm a')} - 
                          {format(new Date(card.punch_out_time), 'h:mm a')} 
                          <span className="font-medium ml-1">({card.total_hours.toFixed(2)} hrs)</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTimeCard(card);
                          setChangeRequestData({
                            proposed_punch_in_time: card.punch_in_time,
                            proposed_punch_out_time: card.punch_out_time,
                            proposed_job_id: card.job_id,
                            proposed_cost_code_id: card.cost_code_id || ''
                          });
                          setShowChangeDialog(true);
                        }}
                        className="w-full sm:w-auto text-xs sm:text-sm"
                      >
                        Request Change
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {changeRequests.length > 0 && (
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-base sm:text-xl">Change Requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {changeRequests.map((request) => (
                    <div key={request.id} className="p-3 sm:p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={
                          request.status === 'approved' ? 'default' : 
                          request.status === 'rejected' ? 'destructive' : 
                          'secondary'
                        } className="text-xs">
                          {request.status}
                        </Badge>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {format(new Date(request.requested_at), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm"><strong>Reason:</strong> {request.reason}</p>
                      {request.review_notes && (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          <strong>Response:</strong> {request.review_notes}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="manual">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base sm:text-xl">Manual Time Entry</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Button onClick={() => navigate('/manual-time-entry')} className="w-full sm:w-auto">
                  Go to Manual Entry Form
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
                  <CardTitle className="text-base sm:text-xl">Edit Profile</CardTitle>
                  <Button
                    variant={editingProfile ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => editingProfile ? handleUpdateProfile() : setEditingProfile(true)}
                    className="w-full sm:w-auto"
                  >
                    {editingProfile ? 'Save Changes' : <><Edit2 className="h-4 w-4 mr-2" />Edit</>}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="space-y-2">
                  <Label className="text-sm">Avatar</Label>
                  <AvatarUploader
                    value={profileData.avatar_url || latestPunchPhoto || ''}
                    onChange={(url) => setProfileData({ ...profileData, avatar_url: url })}
                    disabled={!editingProfile}
                    userId={(user as any).user_id || (user as any).id}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                    disabled={!editingProfile}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                    disabled={!editingProfile}
                    className="text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                  Message Project Managers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {projectManagers.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No project managers assigned to your jobs</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Recipients</Label>
                      <div className="flex flex-wrap gap-2">
                        {projectManagers.map(pm => (
                          <Badge key={pm.id} variant="secondary" className="text-xs">
                            {pm.name} ({pm.jobName})
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Message will be sent to all project managers listed above
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-sm font-medium">Your Message</Label>
                      <Textarea
                        id="message"
                        placeholder="Type your message here..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={6}
                        className="text-sm resize-none"
                      />
                    </div>
                    <Button onClick={handleSendMessage} className="w-full" size="lg">
                      <Send className="h-4 w-4 mr-2" />
                      Send to All PMs
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                  Company Contacts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {companyContacts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">No contacts available</p>
                ) : (
                  <div className="space-y-3">
                    {companyContacts.map(contact => (
                      <div key={contact.id} className="p-3 sm:p-4 border rounded-lg space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm sm:text-base">{contact.name}</h4>
                            <p className="text-xs sm:text-sm text-muted-foreground capitalize">{contact.title}</p>
                          </div>
                          {contact.department && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {contact.department}
                            </Badge>
                          )}
                        </div>
                        {contact.email && (
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            <a href={`mailto:${contact.email}`} className="hover:underline break-all">
                              {contact.email}
                            </a>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            <a href={`tel:${contact.phone}`} className="hover:underline">
                              {contact.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  Company Policies
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {companyPolicies ? (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-xs sm:text-sm">
                    {companyPolicies}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">No company policies have been set</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Request Time Card Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm">Reason for Change</Label>
              <Textarea
                id="reason"
                placeholder="Please explain why you need to change this time card..."
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                rows={4}
                className="text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowChangeDialog(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleRequestChange} className="w-full sm:w-auto">
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

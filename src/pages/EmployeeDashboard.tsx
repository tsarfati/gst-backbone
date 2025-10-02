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
}

export default function EmployeeDashboard() {
  const { user, profile, signOut } = usePunchClockAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [timeCards, setTimeCards] = useState<TimeCard[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeCard, setSelectedTimeCard] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [companyPolicies, setCompanyPolicies] = useState<string>('');
  
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
  const [projectManagerId, setProjectManagerId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const userId = (user as any).user_id || (user as any).id;
      
      // Load time cards
      const { data: timeCardsData } = await supabase
        .from('time_cards')
        .select('*')
        .eq('user_id', userId)
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
      
      // Load profile data
      if (profile) {
        setProfileData({
          email: profile.email || '',
          phone: profile.phone || '',
          avatar_url: profile.avatar_url || ''
        });
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
      
      // Find project manager - get from first assigned job
      const { data: jobAssignment } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_jobs')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (jobAssignment?.assigned_jobs && jobAssignment.assigned_jobs.length > 0) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('project_manager_user_id')
          .eq('id', jobAssignment.assigned_jobs[0])
          .maybeSingle();
        
        if (jobData?.project_manager_user_id) {
          setProjectManagerId(jobData.project_manager_user_id);
        }
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
          time_card_id: selectedTimeCard,
          user_id: userId,
          reason: changeReason,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Change request submitted successfully'
      });

      setShowChangeDialog(false);
      setChangeReason('');
      setSelectedTimeCard(null);
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
    if (!message.trim() || !projectManagerId) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive'
      });
      return;
    }

    try {
      const userId = (user as any).user_id || (user as any).id;
      
      const { error } = await supabase
        .from('messages')
        .insert({
          from_user_id: userId,
          to_user_id: projectManagerId,
          content: message,
          read: false
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Message sent to project manager'
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
      
      const { error } = await supabase
        .from('profiles')
        .update({
          email: profileData.email,
          phone: profileData.phone,
          avatar_url: profileData.avatar_url
        })
        .eq('user_id', userId);

      if (error) throw error;

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
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 h-auto">
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
              <span className="hidden sm:inline">Message PM</span>
              <span className="sm:hidden">Message</span>
            </TabsTrigger>
            <TabsTrigger value="policies" className="text-xs sm:text-sm py-2 col-span-2 sm:col-span-1">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Company Policies</span>
              <span className="sm:hidden">Policies</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timecards" className="space-y-4">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base sm:text-xl">My Time Cards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {timeCards.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No time cards yet</p>
                ) : (
                  timeCards.map((card) => (
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
                          setSelectedTimeCard(card.id);
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
                  <Label htmlFor="avatar" className="text-sm">Avatar URL</Label>
                  <Input
                    id="avatar"
                    value={profileData.avatar_url}
                    onChange={(e) => setProfileData({...profileData, avatar_url: e.target.value})}
                    disabled={!editingProfile}
                    className="text-sm"
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
                  Message Project Manager
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {projectManagerId ? (
                  <>
                    <Textarea
                      placeholder="Type your message here..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={6}
                      className="text-sm resize-none"
                    />
                    <Button onClick={handleSendMessage} className="w-full" size="lg">
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">No project manager assigned</p>
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

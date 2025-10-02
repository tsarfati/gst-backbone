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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/punch-clock-app')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Punch Clock
          </Button>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profileData.avatar_url} />
                <AvatarFallback>{getInitials(profile?.display_name || profile?.first_name)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>{profile?.display_name || `${profile?.first_name} ${profile?.last_name}`}</CardTitle>
                <p className="text-sm text-muted-foreground">{profile?.role || 'Employee'}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="timecards" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="timecards">Time Cards</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="messages">Message PM</TabsTrigger>
            <TabsTrigger value="policies">Company Policies</TabsTrigger>
          </TabsList>

          <TabsContent value="timecards" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Time Cards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {timeCards.map((card) => (
                  <div key={card.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">
                          {format(new Date(card.punch_in_time), 'MMM dd, yyyy')}
                        </span>
                        <Badge variant={card.status === 'approved' ? 'default' : 'secondary'}>
                          {card.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(card.punch_in_time), 'h:mm a')} - 
                        {format(new Date(card.punch_out_time), 'h:mm a')} 
                        ({card.total_hours.toFixed(2)} hours)
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTimeCard(card.id);
                        setShowChangeDialog(true);
                      }}
                    >
                      Request Change
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {changeRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Change Requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {changeRequests.map((request) => (
                    <div key={request.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={
                          request.status === 'approved' ? 'default' : 
                          request.status === 'rejected' ? 'destructive' : 
                          'secondary'
                        }>
                          {request.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(request.requested_at), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <p className="text-sm"><strong>Reason:</strong> {request.reason}</p>
                      {request.review_notes && (
                        <p className="text-sm text-muted-foreground">
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
              <CardHeader>
                <CardTitle>Manual Time Entry</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate('/manual-time-entry')}>
                  Go to Manual Entry Form
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Edit Profile</CardTitle>
                  <Button
                    variant={editingProfile ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => editingProfile ? handleUpdateProfile() : setEditingProfile(true)}
                  >
                    {editingProfile ? 'Save' : <><Edit2 className="h-4 w-4 mr-2" />Edit</>}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="avatar">Avatar URL</Label>
                  <Input
                    id="avatar"
                    value={profileData.avatar_url}
                    onChange={(e) => setProfileData({...profileData, avatar_url: e.target.value})}
                    disabled={!editingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                    disabled={!editingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                    disabled={!editingProfile}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Message Project Manager
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {projectManagerId ? (
                  <>
                    <Textarea
                      placeholder="Type your message here..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={6}
                    />
                    <Button onClick={handleSendMessage} className="w-full">
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">No project manager assigned</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Company Policies
                </CardTitle>
              </CardHeader>
              <CardContent>
                {companyPolicies ? (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {companyPolicies}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No company policies have been set</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Time Card Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Change</Label>
              <Textarea
                id="reason"
                placeholder="Please explain why you need to change this time card..."
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestChange}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Camera, MapPin, Clock, CheckCircle, AlertCircle, Loader2, Sun, Moon, Timer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import EmployeeMessagingPanel from '@/components/EmployeeMessagingPanel';
import { format } from 'date-fns';

interface Job {
  id: string;
  name: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
}

interface PunchStatus {
  id: string;
  job_id: string;
  cost_code_id: string;
  punch_in_time: string;
  punch_in_location_lat?: number;
  punch_in_location_lng?: number;
  punch_in_photo_url?: string;
  is_active: boolean;
}

export default function TimeTracking() {
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = useState<PunchStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedCostCode, setSelectedCostCode] = useState('');
  const [notes, setNotes] = useState('');
  const [showPunchDialog, setShowPunchDialog] = useState(false);
  const [punchType, setPunchType] = useState<'punched_in' | 'punched_out'>('punched_in');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [employeeSettings, setEmployeeSettings] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (user) {
      loadCurrentStatus();
      loadJobs();
      loadEmployeeSettings();
    }
  }, [user]);

  useEffect(() => {
    if (selectedJob) {
      loadCostCodes(selectedJob);
    }
  }, [selectedJob]);

  const loadCurrentStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('current_punch_status')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading punch status:', error);
      } else {
        setCurrentStatus(data);
      }
    } catch (error) {
      console.error('Error loading punch status:', error);
    }
  };

  const loadJobs = async () => {
    if (!user) return;
    
    try {
      // Get assigned jobs from employee settings
      const { data: empSettings } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_jobs')
        .eq('user_id', user.id);

      let jobIds: string[] = [];
      if (empSettings && empSettings.length > 0 && empSettings[0].assigned_jobs) {
        jobIds = empSettings[0].assigned_jobs;
      }

      // If no assigned jobs, get all jobs
      if (jobIds.length === 0) {
        const { data: allJobs, error: allJobsError } = await supabase
          .from('jobs')
          .select('id, name')
          .order('name');
        
        if (allJobsError) {
          console.error('Error loading all jobs:', allJobsError);
          return;
        }
        
        setJobs(allJobs || []);
      } else {
        const { data: assignedJobs, error: assignedJobsError } = await supabase
          .from('jobs')
          .select('id, name')
          .in('id', jobIds)
          .order('name');
        
        if (assignedJobsError) {
          console.error('Error loading assigned jobs:', assignedJobsError);
          return;
        }
        
        setJobs(assignedJobs || []);
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadCostCodes = async (jobId: string) => {
    if (!user) return;

    try {
      // First check employee settings for assigned cost codes
      const { data: empSettings } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_cost_codes')
        .eq('user_id', user.id);

      let costCodeIds: string[] = [];
      if (empSettings && empSettings.length > 0 && empSettings[0].assigned_cost_codes) {
        costCodeIds = empSettings[0].assigned_cost_codes;
      }

      let query = supabase
        .from('cost_codes')
        .select('id, code, description')
        .eq('is_active', true);

      if (costCodeIds.length > 0) {
        query = query.in('id', costCodeIds);
      } else {
        // If no specific cost codes assigned, get job-specific or general cost codes
        query = query.or(`job_id.is.null,job_id.eq.${jobId}`);
      }

      const { data, error } = await query.order('code');

      if (error) {
        console.error('Error loading cost codes:', error);
        return;
      }

      setCostCodes(data || []);
    } catch (error) {
      console.error('Error loading cost codes:', error);
    }
  };

  const loadEmployeeSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('employee_timecard_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading employee settings:', error);
      } else {
        setEmployeeSettings(data);
      }
    } catch (error) {
      console.error('Error loading employee settings:', error);
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'h:mm a');
  };

  const getElapsedTime = () => {
    if (!currentStatus) return '0:00';
    
    const now = new Date();
    const punchInTime = new Date(currentStatus.punch_in_time);
    const diffMs = now.getTime() - punchInTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getGreetingIcon = () => {
    const hour = new Date().getHours();
    if (hour < 6 || hour >= 18) return '🌙';
    return '☀️';
  };

  const startCamera = async () => {
    try {
      setShowCamera(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      throw new Error('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setPhotoBlob(blob);
          setPhotoPreview(URL.createObjectURL(blob));
          stopCamera();
        }
      },
      'image/jpeg',
      0.8
    );
  };

  const uploadPhoto = async (blob: Blob): Promise<string | null> => {
    try {
      const fileExt = 'jpg';
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `punch-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('punch-photos')
        .upload(filePath, blob);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('punch-photos')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  const handlePunchIn = async () => {
    if (!user) {
      toast({
        title: 'Authentication Error',
        description: 'Please log in to use the punch clock.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!selectedJob) {
      toast({
        title: 'Missing Job Selection',
        description: 'Please select a job before punching in.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!selectedCostCode) {
      toast({
        title: 'Missing Cost Code',
        description: 'Please select a cost code before punching in.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setLoadingStatus('Starting camera and location...');

    try {
      setPunchType('punched_in');
      setShowPunchDialog(true);

      // Auto-start camera and location simultaneously
      const promises = [];
      
      if (employeeSettings?.require_photo !== false) {
        promises.push(startCamera());
      }
      
      if (employeeSettings?.require_location !== false) {
        promises.push(
          getCurrentLocation()
            .then(setLocation)
            .catch((error: any) => {
              console.warn('Location unavailable:', error?.message || error);
              toast({
                title: 'Location Unavailable',
                description: 'Proceeding without location.',
                variant: 'default',
              });
            })
        );
      }

      await Promise.allSettled(promises);
    } catch (error: any) {
      console.error('Error during punch in preparation:', error);
      toast({
        title: 'Setup Error',
        description: error.message || 'Could not start camera or location.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const handlePunchOut = async () => {
    if (!user || !currentStatus) return;

    setIsLoading(true);
    setLoadingStatus('Preparing camera...');

    try {
      setPunchType('punched_out');
      setShowPunchDialog(true);

      // Start camera immediately
      await startCamera();

      // Try to fetch location in the background (non-blocking)
      getCurrentLocation()
        .then((currentLocation) => {
          console.log('Location obtained:', currentLocation);
          setLocation(currentLocation);
        })
        .catch((error: any) => {
          console.warn('Location unavailable:', error?.message || error);
          toast({
            title: 'Location Unavailable',
            description: 'Proceeding without location. Please enable location permissions for future punches.',
          });
        });
    } catch (error: any) {
      console.error('Error during punch out preparation:', error);
      toast({
        title: 'Setup Error',
        description: error.message || 'Could not start camera. Please check your browser permissions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const confirmPunch = async () => {
    if (!user) {
      toast({
        title: 'Authentication Error',
        description: 'Please log in to continue.',
        variant: 'destructive',
      });
      return;
    }

    if (employeeSettings?.require_photo !== false && !photoBlob) {
      toast({
        title: 'Photo Required',
        description: 'Please capture a photo to continue.',
        variant: 'destructive',
      });
      return;
    }

    if (employeeSettings?.require_location !== false && !location) {
      toast({
        title: 'Location Required',
        description: 'Please enable location and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setLoadingStatus('Processing punch...');

    try {
      let photoUrl = null;
      if (photoBlob) {
        setLoadingStatus('Uploading photo...');
        photoUrl = await uploadPhoto(photoBlob);
      }

      setLoadingStatus('Recording punch...');

      if (punchType === 'punched_in') {
        // Insert punch_in record
        const { error: punchError } = await supabase
          .from('punch_records')
          .insert({
            user_id: user.id,
            job_id: selectedJob,
            cost_code_id: selectedCostCode,
            punch_type: 'punched_in',
            punch_time: new Date().toISOString(),
            latitude: location?.lat ?? null,
            longitude: location?.lng ?? null,
            photo_url: photoUrl,
            notes: notes || null,
          });

        if (punchError) {
          console.error('Error creating punch in record:', punchError);
          toast({
            title: 'Error',
            description: 'Failed to record punch in. Please try again.',
            variant: 'destructive',
          });
          return;
        }

        // Update current punch status
        const { error: statusError } = await supabase
          .from('current_punch_status')
          .upsert({
            user_id: user.id,
            job_id: selectedJob,
            cost_code_id: selectedCostCode,
            punch_in_time: new Date().toISOString(),
            punch_in_location_lat: location?.lat ?? null,
            punch_in_location_lng: location?.lng ?? null,
            punch_in_photo_url: photoUrl,
            is_active: true,
          });

        if (statusError) {
          console.error('Error updating punch status:', statusError);
          toast({
            title: 'Warning',
            description: 'Punch recorded but status may not be accurate.',
            variant: 'destructive',
          });
        }

        toast({
          title: 'Success',
          description: 'Successfully punched in!',
        });
        
        loadCurrentStatus();
      } else {
        // Insert punch_out record
        const { error: punchError } = await supabase
          .from('punch_records')
          .insert({
            user_id: user.id,
            job_id: currentStatus?.job_id,
            cost_code_id: currentStatus?.cost_code_id,
            punch_type: 'punched_out',
            punch_time: new Date().toISOString(),
            latitude: location?.lat ?? null,
            longitude: location?.lng ?? null,
            photo_url: photoUrl,
            notes: notes || null,
          });

        if (punchError) {
          console.error('Error creating punch out record:', punchError);
          toast({
            title: 'Error',
            description: 'Failed to record punch out. Please try again.',
            variant: 'destructive',
          });
          return;
        }

        // Clear current punch status
        const { error: clearError } = await supabase
          .from('current_punch_status')
          .update({ is_active: false })
          .eq('user_id', user.id);

        if (clearError) {
          console.error('Error clearing punch status:', clearError);
        }

        toast({
          title: 'Success',
          description: 'Successfully punched out!',
        });
        
        setCurrentStatus(null);
      }

      // Reset form
      setShowPunchDialog(false);
      setPhotoBlob(null);
      setPhotoPreview(null);
      setNotes('');
      setLocation(null);
      stopCamera();
    } catch (error: any) {
      console.error('Error during punch:', error);
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 relative">
      {/* App-like container with safe padding */}
      <div className="max-w-lg mx-auto min-h-screen flex flex-col bg-background/95 backdrop-blur-sm border-x border-border/50">
        {/* App Header */}
        <div className="p-6">
          <Card className="shadow-elevation-md border-border/50 overflow-hidden">
            <CardContent className="p-6">
              <div className="bg-gradient-to-r from-primary to-primary-glow p-6 text-center text-primary-foreground shadow-lg rounded-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                      <Clock className="h-6 w-6" />
                    </div>
                    <span className="text-xl font-bold tracking-wide">Time Tracker</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">
                      {getGreeting()} {getGreetingIcon()}
                    </div>
                    <p className="text-primary-foreground/80 text-sm">{user?.email}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-6 pb-6 space-y-6">
          {/* Status Card */}
          <Card className="shadow-elevation-md border-border/50 overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Timer className="h-5 w-5" />
                <span className="font-semibold">Current Status</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentStatus && currentStatus.is_active ? (
                <div className="text-center space-y-4">
                  <div className="relative p-6 bg-gradient-to-br from-success/10 to-success/5 rounded-xl border border-success/20 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-success/5 to-transparent"></div>
                    <div className="relative z-10">
                      <div className="text-success font-semibold mb-3 flex items-center justify-center gap-2">
                        <div className="p-1 bg-success/20 rounded-full">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                        Actively Working
                      </div>
                      <div className="text-3xl font-bold text-foreground mb-2">
                        {formatTime(currentStatus.punch_in_time)}
                      </div>
                      <div className="text-sm text-success/80 font-medium">
                        Elapsed: {getElapsedTime()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-gradient-to-br from-muted/80 to-muted/40 rounded-lg border border-border/50">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cost Code</div>
                      <div className="font-semibold text-sm truncate">
                        {costCodes.find(c => c.id === currentStatus.cost_code_id)?.code || 'N/A'}
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-muted/80 to-muted/40 rounded-lg border border-border/50">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Job</div>
                      <div className="font-semibold text-sm truncate">
                        {jobs.find(j => j.id === currentStatus.job_id)?.name || 'Unknown Job'}
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handlePunchOut}
                    variant="destructive"
                    size="lg"
                    className="w-full py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 ripple"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Punch Out
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="text-center p-6 bg-gradient-to-br from-muted/50 to-muted/20 rounded-xl border border-dashed border-border">
                    <div className="text-muted-foreground text-sm mb-2">Ready to start your day?</div>
                    <div className="text-lg font-semibold">Select job and punch in</div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="job-select" className="text-sm font-medium">Job Selection</Label>
                      <Select value={selectedJob} onValueChange={setSelectedJob}>
                        <SelectTrigger className="h-12 border-2 rounded-xl transition-colors focus:border-primary">
                          <SelectValue placeholder="Choose your job" />
                        </SelectTrigger>
                        <SelectContent className="w-[var(--radix-popper-anchor-width)] max-w-[95vw] rounded-xl">
                          {jobs.map((job) => (
                            <SelectItem key={job.id} value={job.id} className="rounded-lg">
                              {job.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {selectedJob && (
                      <div className="space-y-2 animate-slide-up">
                        <Label htmlFor="cost-code-select" className="text-sm font-medium">Cost Code</Label>
                        <Select value={selectedCostCode} onValueChange={setSelectedCostCode}>
                          <SelectTrigger className="h-12 border-2 rounded-xl transition-colors focus:border-primary">
                            <SelectValue placeholder="Choose cost code" />
                          </SelectTrigger>
                          <SelectContent className="w-[var(--radix-popper-anchor-width)] max-w-[95vw] rounded-xl">
                            {costCodes.map((code) => (
                              <SelectItem key={code.id} value={code.id} className="rounded-lg">
                                {code.code} - {code.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    onClick={handlePunchIn}
                    disabled={!selectedJob || !selectedCostCode || isLoading}
                    className="w-full h-14 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 ripple"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        {loadingStatus}
                      </>
                    ) : (
                      <>
                        <Timer className="h-5 w-5 mr-2" />
                        Start Working
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Employee Messaging Panel */}
          {currentStatus && (
            <div className="animate-fade-in">
              <EmployeeMessagingPanel 
                currentJobId={currentStatus.job_id}
                isVisible={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Punch Dialog */}
      <Dialog open={showPunchDialog} onOpenChange={(open) => { setShowPunchDialog(open); if (!open) { stopCamera(); setPhotoPreview(null); setPhotoBlob(null); } }}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-lg mx-auto max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader className="text-center pb-4">
            <DialogTitle className="text-xl font-bold">
              {punchType === 'punched_in' ? 'Start Working' : 'Complete Workday'}
            </DialogTitle>
            <DialogDescription className="text-base">
              {punchType === 'punched_in' ? 'Take a photo and punch in to begin' : 'Take a photo and add notes to finish'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {location && (
              <div className="flex items-center gap-2 text-sm text-success bg-success/10 p-3 rounded-lg border border-success/20">
                <MapPin className="h-4 w-4" />
                Location verified
              </div>
            )}
            
            {showCamera && (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-xl bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    controls={false}
                    className="w-full"
                    style={{ aspectRatio: '4/3' }}
                  />
                  <div className="absolute inset-0 border-2 border-primary/30 rounded-xl"></div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={capturePhoto} className="flex-1 h-12 rounded-xl">
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </Button>
                  <Button variant="outline" onClick={stopCamera} className="px-6 h-12 rounded-xl">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            {photoPreview && (
              <div className="space-y-4">
                <div className="relative">
                  <img src={photoPreview} alt="Captured" className="w-full rounded-xl border border-border" />
                  <div className="absolute top-2 right-2 bg-success/20 text-success p-1 rounded-full">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPhotoPreview(null);
                    setPhotoBlob(null);
                    startCamera();
                  }}
                  className="w-full h-12 rounded-xl"
                >
                  Retake Photo
                </Button>
              </div>
            )}
            
            {punchType === 'punched_out' && (
              <div className="space-y-2">
                <Label htmlFor="notes" className="font-medium">Work Summary (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe what you accomplished today..."
                  className="rounded-xl border-2 min-h-[100px] resize-none"
                />
              </div>
            )}
            
            <div className="flex gap-3">
              <Button
                onClick={confirmPunch}
                disabled={((employeeSettings?.require_photo !== false) && !photoBlob) || isLoading}
                className="flex-1 h-12 rounded-xl shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {loadingStatus}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {punchType === 'punched_in' ? 'Start Working' : 'Finish Work'}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPunchDialog(false);
                  stopCamera();
                  setPhotoPreview(null);
                  setPhotoBlob(null);
                }}
                className="px-6 h-12 rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </div>
          
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
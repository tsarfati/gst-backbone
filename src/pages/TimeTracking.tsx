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
    if (!currentStatus) return '0:00:00';
    
    const now = new Date();
    const punchInTime = new Date(currentStatus.punch_in_time);
    const diffMs = now.getTime() - punchInTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Real-time update for elapsed time
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

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

      // Start camera immediately
      if (employeeSettings?.require_photo !== false) {
        await startCamera();
      }

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
          }, { onConflict: 'user_id' });

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
        
        // Immediately update local state to reflect punched in status
        const newStatus: PunchStatus = {
          id: 'temp-id',
          job_id: selectedJob,
          cost_code_id: selectedCostCode,
          punch_in_time: new Date().toISOString(),
          punch_in_location_lat: location?.lat ?? null,
          punch_in_location_lng: location?.lng ?? null,
          punch_in_photo_url: photoUrl,
          is_active: true,
        };
        setCurrentStatus(newStatus);
        
        // Force reload of current status to get the correct ID
        setTimeout(() => loadCurrentStatus(), 100);
      } else {
        // Calculate distance from job if job has coordinates
        let distanceWarning = false;
        let distanceFromJob = null;

        if (location && currentStatus?.job_id) {
          const { data: jobData } = await supabase
            .from('jobs')
            .select('latitude, longitude')
            .eq('id', currentStatus.job_id)
            .single();

          if (jobData?.latitude && jobData?.longitude) {
            // Calculate distance using Haversine formula
            const lat1 = location.lat * Math.PI / 180;
            const lat2 = jobData.latitude * Math.PI / 180;
            const deltaLat = (jobData.latitude - location.lat) * Math.PI / 180;
            const deltaLng = (jobData.longitude - location.lng) * Math.PI / 180;

            const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                    Math.cos(lat1) * Math.cos(lat2) *
                    Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distanceFromJob = 6371000 * c; // Distance in meters

            // Check distance warning settings
            const { data: punchSettings } = await supabase
              .from('punch_clock_settings')
              .select('enable_distance_warnings, max_distance_from_job_meters')
              .single();

            if (punchSettings?.enable_distance_warnings && distanceFromJob > (punchSettings.max_distance_from_job_meters || 200)) {
              distanceWarning = true;
            }
          }
        }

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

        // Create time card entry with appropriate approval status
        const requiresApproval = distanceWarning; // Only require approval if distance warning

        const { error: timeCardError } = await supabase
          .from('time_cards')
          .insert({
            user_id: user.id,
            job_id: currentStatus?.job_id,
            cost_code_id: currentStatus?.cost_code_id,
            punch_in_time: currentStatus?.punch_in_time,
            punch_out_time: new Date().toISOString(),
            total_hours: currentStatus ? 
              Math.max(0, (Date.now() - new Date(currentStatus.punch_in_time).getTime()) / (1000 * 60 * 60)) : 0,
            overtime_hours: 0, // Will be calculated by trigger
            status: requiresApproval ? 'submitted' : 'approved',
            break_minutes: 0,
            notes: notes || null,
            punch_in_location_lat: currentStatus?.punch_in_location_lat,
            punch_in_location_lng: currentStatus?.punch_in_location_lng,
            punch_out_location_lat: location?.lat,
            punch_out_location_lng: location?.lng,
            punch_in_photo_url: currentStatus?.punch_in_photo_url,
            punch_out_photo_url: photoUrl,
            created_via_punch_clock: true,
            requires_approval: requiresApproval,
            distance_warning: distanceWarning,
            distance_from_job_meters: distanceFromJob
          });

        if (timeCardError) {
          console.error('Error creating time card:', timeCardError);
        }

        toast({
          title: 'Success',
          description: distanceWarning ? 
            'Punch out recorded with distance warning!' : 
            'Successfully punched out!',
          variant: distanceWarning ? 'destructive' : 'default',
        });
        
        setCurrentStatus(null);
      }

      // Reset form
      setPhotoBlob(null);
      setPhotoPreview(null);
      setNotes('');
      setLocation(null);
      setShowPunchDialog(false);
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
      {/* Mobile-first container - left aligned */}
      <div className="w-full max-w-4xl min-h-screen flex flex-col bg-background/95 backdrop-blur-sm px-8 md:px-16">
        {/* Welcome Header */}
        <div className="px-4 py-4">
          <Card className="shadow-elevation-md border-border/50 bg-card/95 backdrop-blur-sm rounded-2xl">
            <CardContent className="p-4">
              <div className="text-left space-y-2">
                <div className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <span className="text-xl">{getGreetingIcon()}</span>
                  <span>{getGreeting()}, {profile?.first_name || 'Employee'}!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(), 'EEEE, MMMM do, yyyy')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-4 pb-6">
          {/* Large Status Display */}
          <div className="text-left mb-6">
            {currentStatus && currentStatus.is_active ? (
              <div className="space-y-4">
                {/* Large Green Status Icon - Left aligned */}
                <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  <Clock className="h-12 w-12 text-white" />
                </div>
                
                {/* Live Timer */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-2xl p-6 border border-green-200 dark:border-green-800">
                  <div className="text-4xl font-mono font-bold text-green-700 dark:text-green-300 mb-2">
                    {getElapsedTime()}
                  </div>
                  <div className="text-green-600 dark:text-green-400 font-medium">
                    Started at {formatTime(currentStatus.punch_in_time)}
                  </div>
                </div>
                
                {/* Job Info */}
                <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
                  <div className="text-sm text-muted-foreground mb-1">Working on</div>
                  <div className="font-semibold text-lg">{jobs.find(j => j.id === currentStatus.job_id)?.name || 'Unknown Job'}</div>
                  <div className="text-sm text-muted-foreground">{costCodes.find(c => c.id === currentStatus.cost_code_id)?.code || 'N/A'}</div>
                </div>

                {/* Inline Camera for Punch Out */}
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
                  </div>
                )}
                
                {/* Punch Out Button */}
                <Button 
                  onClick={showCamera ? confirmPunch : handlePunchOut}
                  disabled={showCamera && ((employeeSettings?.require_photo !== false) && !photoBlob) || isLoading}
                  className="w-full h-16 text-xl font-bold rounded-2xl bg-red-600 hover:bg-red-700 text-white shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                      {loadingStatus}
                    </>
                  ) : showCamera && photoBlob ? (
                    <>
                      <CheckCircle className="h-6 w-6 mr-3" />
                      Complete Punch Out
                    </>
                  ) : (
                    <>
                      <Camera className="h-6 w-6 mr-3" />
                      {showCamera ? 'Take Photo First' : 'Punch Out'}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Large Red Status Icon - Left aligned */}
                <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                  <Timer className="h-12 w-12 text-white" />
                </div>
                
                <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 rounded-2xl p-6 border border-red-200 dark:border-red-800">
                  <div className="text-3xl font-bold text-red-700 dark:text-red-300 mb-2">Punched Out</div>
                  <div className="text-red-600 dark:text-red-400">Ready to start your shift</div>
                </div>
                
                {/* Job Selection */}
                <div className="space-y-4">
                  <Select value={selectedJob} onValueChange={setSelectedJob}>
                    <SelectTrigger className="h-14 text-lg rounded-xl border-2">
                      <SelectValue placeholder="Select Job" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id} className="text-lg py-3">
                          {job.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedJob && (
                    <Select value={selectedCostCode} onValueChange={setSelectedCostCode}>
                      <SelectTrigger className="h-14 text-lg rounded-xl border-2">
                        <SelectValue placeholder="Select Cost Code" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {costCodes.map((code) => (
                          <SelectItem key={code.id} value={code.id} className="text-lg py-3">
                            {code.code} - {code.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Inline Camera for Punch In */}
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
                  
                  <Button
                    onClick={showCamera ? confirmPunch : handlePunchIn}
                    disabled={(!showCamera && (!selectedJob || !selectedCostCode)) || (showCamera && ((employeeSettings?.require_photo !== false) && !photoBlob)) || isLoading}
                    className="w-full h-16 text-xl font-bold rounded-2xl bg-green-600 hover:bg-green-700 text-white shadow-lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                        {loadingStatus}
                      </>
                    ) : showCamera && photoBlob ? (
                      <>
                        <CheckCircle className="h-6 w-6 mr-3" />
                        Complete Punch In
                      </>
                    ) : (
                      <>
                        <Camera className="h-6 w-6 mr-3" />
                        {showCamera ? 'Take Photo First' : 'Punch In'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

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

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
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
        photoUrl = await uploadPhoto(photoBlob);
        if (!photoUrl) {
          throw new Error('Failed to upload photo');
        }
      }

      if (punchType === 'punched_in') {
        // Create punch in record
        const { error: punchError } = await supabase
          .from('punch_records')
          .insert({
            user_id: user.id,
            job_id: selectedJob,
            cost_code_id: selectedCostCode,
            punch_type: 'punched_in',
            latitude: location?.lat,
            longitude: location?.lng,
            photo_url: photoUrl,
            notes: notes || null
          });

        if (punchError) throw punchError;

        // Create current status
        const { error: statusError } = await supabase
          .from('current_punch_status')
          .insert({
            user_id: user.id,
            job_id: selectedJob,
            cost_code_id: selectedCostCode,
            punch_in_time: new Date().toISOString(),
            punch_in_location_lat: location?.lat,
            punch_in_location_lng: location?.lng,
            punch_in_photo_url: photoUrl,
            is_active: true
          });

        if (statusError) throw statusError;
      } else {
        // Punch out
        const { error: punchError } = await supabase
          .from('punch_records')
          .insert({
            user_id: user.id,
            job_id: currentStatus.job_id,
            cost_code_id: currentStatus.cost_code_id,
            punch_type: 'punched_out',
            latitude: location?.lat,
            longitude: location?.lng,
            photo_url: photoUrl,
            notes: notes || null
          });

        if (punchError) throw punchError;

        // Deactivate current status
        const { error: statusError } = await supabase
          .from('current_punch_status')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (statusError) throw statusError;
      }

      // Reset form
      setNotes('');
      if (punchType === 'punched_in') {
        setSelectedJob('');
        setSelectedCostCode('');
      }
      setPhotoBlob(null);
      setPhotoPreview(null);
      setLocation(null);
      stopCamera();

      // Reload current status
      loadCurrentStatus();

    } catch (error: any) {
      console.error('Error during punch:', error);
      toast({
        title: 'Punch Error',
        description: error.message || 'Failed to record punch. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-4 py-4 space-y-6">
        {/* Greeting Section */}
        <div className="text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{getGreetingIcon()}</span>
            <h2 className="text-lg font-medium text-muted-foreground">{getGreeting()}</h2>
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {profile?.display_name || profile?.first_name || 'Employee'}
          </h1>
        </div>

        {/* Status Display */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-y-4">
              <div className="flex justify-center w-full">
                <div className="relative">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 ${
                    currentStatus ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                  }`}>
                    <Clock className={`w-12 h-12 ${currentStatus ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ${
                    currentStatus ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {currentStatus ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              </div>
            </div>
              
            <div className="text-left mt-4">
              <p className="text-lg font-semibold">
                {currentStatus ? 'Punched In' : 'Punched Out'}
              </p>
              {currentStatus && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Since {formatTime(currentStatus.punch_in_time)}
                  </p>
                  <p className="text-lg font-mono font-bold text-primary">
                    {getElapsedTime()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Job and Cost Code Selection */}
        {!currentStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="text-left">Select Job & Cost Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="job-select">Job</Label>
                <Select value={selectedJob} onValueChange={setSelectedJob}>
                  <SelectTrigger id="job-select" className="bg-background border border-input">
                    <SelectValue placeholder="Choose a job" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-input z-50">
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cost-code-select">Cost Code</Label>
                <Select value={selectedCostCode} onValueChange={setSelectedCostCode}>
                  <SelectTrigger id="cost-code-select" className="bg-background border border-input">
                    <SelectValue placeholder="Choose a cost code" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-input z-50">
                    {costCodes.map((code) => (
                      <SelectItem key={code.id} value={code.id}>
                        {code.code} - {code.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this punch..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-background border border-input"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Punch Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-left">
              {!currentStatus ? (
                <Button 
                  onClick={handlePunchIn}
                  disabled={isLoading || !selectedJob || !selectedCostCode}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{loadingStatus}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Timer className="h-6 w-6" />
                      <span>Punch In</span>
                    </div>
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={handlePunchOut}
                  disabled={isLoading}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold bg-red-600 hover:bg-red-700 text-white"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{loadingStatus}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Timer className="h-6 w-6" />
                      <span>Punch Out</span>
                    </div>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Messaging Panel */}
        <EmployeeMessagingPanel isVisible={true} />

        {/* Camera Dialog */}
        <Dialog open={showCamera} onOpenChange={setShowCamera}>
          <DialogContent className="w-full max-w-md">
            <DialogHeader>
              <DialogTitle>Take Photo</DialogTitle>
              <DialogDescription>
                Capture a photo for your {punchType === 'punched_in' ? 'punch in' : 'punch out'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col items-center space-y-4">
              <div className="relative w-full">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg border"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
              </div>
              
              <div className="flex gap-3">
                <Button onClick={capturePhoto} size="lg">
                  <Camera className="h-5 w-5 mr-2" />
                  Capture Photo
                </Button>
                <Button onClick={() => setShowCamera(false)} variant="outline" size="lg">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Photo Preview Dialog */}
        <Dialog open={!!photoPreview} onOpenChange={(open) => !open && setPhotoPreview(null)}>
          <DialogContent className="w-full max-w-md">
            <DialogHeader>
              <DialogTitle>Complete {punchType === 'punched_in' ? 'Punch In' : 'Punch Out'}</DialogTitle>
              <DialogDescription>
                Photo captured successfully
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col items-center space-y-4">
              {photoPreview && (
                <img 
                  src={photoPreview} 
                  alt="Captured photo" 
                  className="w-full rounded-lg border"
                />
              )}
              
              <div className="flex gap-3 w-full">
                {punchType === 'punched_out' ? (
                  <Button 
                    onClick={confirmPunch} 
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white" 
                    disabled={isLoading}
                    size="lg"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Timer className="h-5 w-5" />
                        <span>Punch Out</span>
                      </div>
                    )}
                  </Button>
                ) : (
                  <Button onClick={confirmPunch} className="flex-1" disabled={isLoading} size="lg">
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Timer className="h-5 w-5" />
                        <span>Punch In</span>
                      </div>
                    )}
                  </Button>
                )}
                <Button onClick={() => {
                  setPhotoPreview(null);
                  setPhotoBlob(null);
                  if (employeeSettings?.require_photo !== false) {
                    startCamera();
                  }
                }} variant="outline" size="lg">
                  Retake
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
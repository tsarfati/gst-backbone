import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Camera, MapPin, Clock, CheckCircle, AlertCircle, Loader2, Sun, Moon } from 'lucide-react';
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
  const [punchType, setPunchType] = useState<'in' | 'out'>('in');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [employeeSettings, setEmployeeSettings] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Ensure video element receives the stream once mounted (prevents race conditions on mobile)
  useEffect(() => {
    if (!showCamera || !cameraStream) return;
    const video = videoRef.current;
    if (!video) return;
    try {
      // Attach stream and enforce mobile-friendly attributes
      // @ts-ignore
      video.srcObject = cameraStream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('muted', 'true');
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch((e: any) => console.warn('Auto play failed:', e));
      }
    } catch (e) {
      console.warn('Attaching stream failed:', e);
    }
  }, [showCamera, cameraStream]);

  useEffect(() => {
    if (user) {
      loadCurrentStatus();
      loadJobs();
      loadEmployeeSettings();
      // Auto-start location in background
      getCurrentLocation()
        .then(setLocation)
        .catch(() => {}); // Silently fail, user will be prompted later
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
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setCurrentStatus(data);
    } catch (error) {
      console.error('Error loading punch status:', error);
    }
  };

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadCostCodes = async (jobId: string) => {
    try {
      // First try to load cost codes assigned to employee for this job
      let query = supabase
        .from('cost_codes')
        .select('id, code, description')
        .eq('is_active', true);
      
      // If employee has settings with assigned cost codes, filter by those
      if (employeeSettings?.assigned_cost_codes?.length > 0) {
        query = query.in('id', employeeSettings.assigned_cost_codes);
      }
      
      // If job is specified, filter by job
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data, error } = await query.order('code');

      if (error) throw error;
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
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setEmployeeSettings(data);
      
      // Auto-select default job if available
      if (data?.default_job_id && !selectedJob) {
        setSelectedJob(data.default_job_id);
      }
      
      // Auto-select default cost code if available
      if (data?.default_cost_code_id && !selectedCostCode) {
        setSelectedCostCode(data.default_cost_code_id);
      }
    } catch (error) {
      console.error('Error loading employee settings:', error);
    }
  };

  const getCurrentLocation = (): Promise<{lat: number, lng: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser');
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      console.log('Requesting geolocation permission...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Geolocation success:', position.coords);
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Geolocation error:', error.code, error.message);
          let errorMessage = 'Location access denied';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    });
  };

  const startCamera = async () => {
    try {
      setLoadingStatus('Starting camera...');
      console.log('Starting camera - checking support...');
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported by this browser');
      }

      console.log('getUserMedia is supported');

      // For mobile devices, prefer front camera
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('Is mobile device:', isMobile);

      let stream: MediaStream;
      
      if (isMobile) {
        // On mobile, try front camera first
        try {
          console.log('Trying front camera on mobile...');
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 }
            },
            audio: false
          });
          console.log('Front camera successful:', stream);
        } catch (frontError) {
          console.warn('Front camera failed, trying back camera:', frontError);
          // Fallback to back camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 }
            },
            audio: false
          });
          console.log('Back camera successful:', stream);
        }
      } else {
        // On desktop, use default camera
        console.log('Using default camera for desktop...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 }
          },
          audio: false
        });
        console.log('Desktop camera successful:', stream);
      }

      setCameraStream(stream);
      setShowCamera(true);
      
      if (videoRef.current) {
        console.log('Setting video source...');
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        
        // For iOS Safari, we need to handle the play promise
        try {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
            console.log('Video started playing successfully');
          }
        } catch (playError) {
          console.warn('Video play failed, but continuing:', playError);
          // Don't throw here, video might still work
        }
      }
      
    } catch (error: any) {
      console.error('Camera error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Could not access camera. Please check permissions.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please allow camera permissions and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Camera is not supported by this browser.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints not satisfied. Trying with basic settings.';
        
        // Try again with minimal constraints
        try {
          console.log('Retrying with minimal constraints...');
          const basicStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          
          setCameraStream(basicStream);
          setShowCamera(true);
          
          if (videoRef.current) {
            videoRef.current.srcObject = basicStream;
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;
            await videoRef.current.play().catch(e => console.warn('Basic video play failed:', e));
          }
          return; // Success with basic constraints
        } catch (basicError) {
          console.error('Basic constraints also failed:', basicError);
        }
      }
      
      toast({
        title: 'Camera Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          setPhotoBlob(blob);
          setPhotoPreview(URL.createObjectURL(blob));
          stopCamera();
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const uploadPhoto = async (blob: Blob): Promise<string | null> => {
    if (!user) return null;

    try {
      const fileName = `${Date.now()}-punch-photo.jpg`;
      const filePath = `${user.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('punch-photos')
        .upload(filePath, blob);

      if (error) throw error;

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
    if (!user || !selectedJob || !selectedCostCode) {
      toast({
        title: 'Missing Information',
        description: 'Please select a job and cost code before punching in.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setLoadingStatus('Starting camera and location...');

    try {
      setPunchType('in');
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
      setPunchType('out');
      setShowPunchDialog(true); // Always show dialog

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
    if (!user) return;

    setIsLoading(true);
    setLoadingStatus('Processing punch...');

    try {
      let photoUrl = null;
      if (photoBlob) {
        setLoadingStatus('Uploading photo...');
        photoUrl = await uploadPhoto(photoBlob);
      }

      if (punchType === 'in') {
        // Get IP address and user agent
        let ipAddress = null;
        let userAgent = null;
        try {
          const ipResponse = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipResponse.json();
          ipAddress = ipData.ip;
          userAgent = navigator.userAgent;
        } catch (error) {
          console.warn('Could not get IP address:', error);
        }

        // Create punch record
        const { error: punchError } = await supabase
          .from('punch_records')
          .insert({
            user_id: user.id,
            job_id: selectedJob,
            cost_code_id: selectedCostCode,
            punch_type: 'punched_in',
            latitude: location?.lat ?? null,
            longitude: location?.lng ?? null,
            photo_url: photoUrl,
            ip_address: ipAddress,
            user_agent: userAgent
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
            punch_in_location_lat: location?.lat ?? null,
            punch_in_location_lng: location?.lng ?? null,
            punch_in_photo_url: photoUrl
          });

        if (statusError) throw statusError;

        toast({
          title: 'Punched In',
          description: 'Successfully punched in for the selected job.',
        });
      } else {
        // Get IP address and user agent
        let ipAddress = null;
        let userAgent = null;
        try {
          const ipResponse = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipResponse.json();
          ipAddress = ipData.ip;
          userAgent = navigator.userAgent;
        } catch (error) {
          console.warn('Could not get IP address:', error);
        }

        // Create punch out record
        const { error: punchError } = await supabase
          .from('punch_records')
          .insert({
            user_id: user.id,
            job_id: currentStatus?.job_id,
            cost_code_id: currentStatus?.cost_code_id,
            punch_type: 'punched_out',
            latitude: location?.lat ?? null,
            longitude: location?.lng ?? null,
            photo_url: photoUrl,
            notes: notes || null,
            ip_address: ipAddress,
            user_agent: userAgent
          });

        if (punchError) throw punchError;

        // Remove current status
        const { error: statusError } = await supabase
          .from('current_punch_status')
          .update({ is_active: false })
          .eq('id', currentStatus.id);

        if (statusError) throw statusError;

        toast({
          title: 'Punched Out',
          description: 'Successfully punched out.',
        });
      }

      // Reload status
      await loadCurrentStatus();
      
      // Reset form
      setSelectedJob('');
      setSelectedCostCode('');
      setNotes('');
      setPhotoBlob(null);
      setPhotoPreview(null);
      setShowPunchDialog(false);
      
    } catch (error) {
      console.error('Error processing punch:', error);
      toast({
        title: 'Error',
        description: 'Failed to process punch. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getElapsedTime = () => {
    if (!currentStatus) return '0:00';
    
    const start = new Date(currentStatus.punch_in_time).getTime();
    const now = new Date().getTime();
    const elapsed = Math.floor((now - start) / 1000);
    
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getGreetingIcon = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 18) {
      return <Sun className="h-5 w-5 text-amber-500" />;
    }
    return <Moon className="h-4 w-4 text-blue-400" />;
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Mobile-optimized container */}
      <div className="w-full mx-0 md:max-w-4xl md:mx-auto p-4 md:p-6 space-y-4 md:space-y-6 h-full">

        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Punch Clock</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Track your work hours with job and cost code selection
          </p>
        </div>

        {/* Welcome Header (moved below title) */}
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getGreetingIcon()}
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {getGreeting()}, {profile?.first_name || profile?.display_name || 'Employee'}!
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(), 'EEEE, MMMM do, yyyy')} • {currentCompany?.display_name || currentCompany?.name || 'Your Company'}
                  </p>
                </div>
              </div>
              {currentCompany?.logo_url && (
                <img 
                  src={currentCompany.logo_url.includes('http') 
                    ? currentCompany.logo_url 
                    : `https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/${currentCompany.logo_url.replace('company-logos/', '')}`
                  } 
                  alt="Company Logo" 
                  className="h-12 w-12 object-contain rounded-md" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>

      {/* Current Status - Mobile optimized */}
      <Card className="shadow-elevation-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Clock className="h-5 w-5" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStatus ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:justify-between">
                <Badge variant="secondary" className="px-3 py-2 text-sm">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Punched In
                </Badge>
                <div className="text-3xl md:text-4xl font-mono font-bold text-center">
                  {getElapsedTime()}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Started:</span>
                  <div className="font-medium">{formatTime(currentStatus.punch_in_time)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Job:</span>
                  <div className="font-medium">
                    {jobs.find(j => j.id === currentStatus.job_id)?.name || 'Unknown Job'}
                  </div>
                </div>
              </div>
              
              <Button
                onClick={handlePunchOut}
                disabled={isLoading}
                className="w-full"
                variant="destructive"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {loadingStatus}
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Punch Out
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-muted-foreground">Not currently punched in</div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="job-select">Select Job</Label>
                  <Select value={selectedJob} onValueChange={setSelectedJob}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedJob && (
                  <div>
                    <Label htmlFor="cost-code-select">Select Cost Code</Label>
                    <Select value={selectedCostCode} onValueChange={setSelectedCostCode}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a cost code" />
                      </SelectTrigger>
                      <SelectContent>
                        {costCodes.map((code) => (
                          <SelectItem key={code.id} value={code.id}>
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
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {loadingStatus}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Punch In
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Punch Dialog */}
      <Dialog open={showPunchDialog} onOpenChange={(open) => { setShowPunchDialog(open); if (!open) { stopCamera(); setPhotoPreview(null); setPhotoBlob(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {punchType === 'in' ? 'Punch In' : 'Punch Out'}
            </DialogTitle>
            <DialogDescription>
              Take a photo and confirm your {punchType === 'in' ? 'punch in' : 'punch out'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Location captured ({location.lat?.toFixed(4)}, {location.lng?.toFixed(4)})
              </div>
            )}
            
            {showCamera && (
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  controls={false}
                  className="w-full rounded-lg bg-black"
                  style={{ aspectRatio: '4/3' }}
                />
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} className="flex-1">
                    <Camera className="h-4 w-4 mr-2" />
                    Capture Photo
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            {photoPreview && (
              <div className="space-y-4">
                <img src={photoPreview} alt="Captured" className="w-full rounded-lg" />
                <Button
                  variant="outline"
                  onClick={() => {
                    setPhotoPreview(null);
                    setPhotoBlob(null);
                    startCamera();
                  }}
                >
                  Retake Photo
                </Button>
              </div>
            )}
            
            {punchType === 'out' && (
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about your work..."
                />
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={confirmPunch}
                disabled={!photoBlob || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {loadingStatus}
                  </>
                ) : (
                  `Confirm ${punchType === 'in' ? 'Punch In' : 'Punch Out'}`
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
              >
                Cancel
              </Button>
            </div>
          </div>
          
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </DialogContent>
      </Dialog>

        {/* Employee Messaging Panel */}
        {currentStatus && (
          <EmployeeMessagingPanel 
            currentJobId={currentStatus.job_id}
            isVisible={!!currentStatus}
          />
        )}
      </div>
    </div>
  );
}
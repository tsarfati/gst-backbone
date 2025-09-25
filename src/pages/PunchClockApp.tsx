import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, Camera, MapPin, User, Building, CheckCircle, AlertCircle, LogOut } from 'lucide-react';
import { usePunchClockAuth } from '@/contexts/PunchClockAuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { pipeline, env } from '@huggingface/transformers';

interface Job {
  id: string;
  name: string;
  address?: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
}

interface PunchStatus {
  id: string;
  job_id?: string;
  cost_code_id?: string;
  punch_in_time: string;
  punch_in_location_lat?: number;
  punch_in_location_lng?: number;
  punch_in_photo_url?: string;
}

export default function PunchClockApp() {
  const { user, profile, signOut, isPinAuthenticated } = usePunchClockAuth();
  const { toast } = useToast();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [selectedCostCode, setSelectedCostCode] = useState<string>('');
  const [currentPunch, setCurrentPunch] = useState<PunchStatus | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [faceDetectionResult, setFaceDetectionResult] = useState<{ hasFace: boolean; confidence?: number } | null>(null);
  const [isDetectingFace, setIsDetectingFace] = useState(false);
  const [loginSettings, setLoginSettings] = useState<any>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load login settings for background styling
  useEffect(() => {
    loadLoginSettings();
  }, []);

  // Load initial data
  useEffect(() => {
    if (user) {
      if (isPinAuthenticated) {
        loadFromEdge();
        getCurrentLocation();
      } else {
        loadJobs();
        loadCostCodes();
        loadCurrentPunchStatus();
        getCurrentLocation();
      }
    }
  }, [user, isPinAuthenticated]);

  const loadLoginSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('punch_clock_login_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading login settings:', error);
        return;
      }

      if (data) {
        setLoginSettings(data);
      }
    } catch (error) {
      console.error('Error loading login settings:', error);
    }
  };

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, address')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadCostCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setCostCodes(data || []);
    } catch (error) {
      console.error('Error loading cost codes:', error);
    }
  };

  const loadCurrentPunchStatus = async () => {
    if (!user) return;

    const userId = isPinAuthenticated ? (user as any).user_id : (user as any).id;

    try {
      const { data, error } = await supabase
        .from('current_punch_status')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setCurrentPunch(data);
    } catch (error) {
      console.error('Error loading punch status:', error);
    }
  };

  // Edge function helpers for PIN-authenticated mode
  const FUNCTION_BASE = 'https://watxvzoolmfjfijrgcvq.supabase.co/functions/v1/punch-clock';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q';

  const getPin = () => {
    try { const data = localStorage.getItem('punch_clock_user'); return data ? JSON.parse(data).pin : null; } catch { return null; }
  };

  const loadFromEdge = async () => {
    const pin = getPin();
    if (!pin) return;
    try {
      const res = await fetch(`${FUNCTION_BASE}/init?pin=${pin}`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
      const json = await res.json();
      if (res.ok) {
        setJobs(json.jobs || []);
        setCostCodes(json.cost_codes || []);
        setCurrentPunch(json.current_punch || null);
      } else {
        console.error('Edge init error:', json);
      }
    } catch (e) { console.error('Edge init exception', e); }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            title: 'Location Error',
            description: 'Could not get your location. Please enable location services.',
            variant: 'destructive'
          });
        }
      );
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera Error',
        description: 'Could not access camera. Please enable camera permissions.',
        variant: 'destructive'
      });
    }
  };

  const detectFace = async (imageData: string): Promise<{ hasFace: boolean; confidence?: number }> => {
    try {
      // Configure transformers.js
      env.allowLocalModels = false;
      env.useBrowserCache = false;

      // Initialize face detection pipeline
      const detector = await pipeline('object-detection', 'Xenova/detr-resnet-50', {
        device: 'webgpu',
      });

      // Run detection
      const results = await detector(imageData);
      
      // Look for person/face detection
      const faceDetections = results.filter((result: any) => 
        result.label === 'person' && result.score > 0.5
      );

      return {
        hasFace: faceDetections.length > 0,
        confidence: faceDetections.length > 0 ? Math.max(...faceDetections.map((d: any) => d.score)) : 0
      };
    } catch (error) {
      console.error('Face detection error:', error);
      // Fallback to allow photo if detection fails
      return { hasFace: true };
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      
      // Get image data for face detection
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      // Detect face
      setIsDetectingFace(true);
      const faceResult = await detectFace(imageData);
      setFaceDetectionResult(faceResult);
      setIsDetectingFace(false);

      if (!faceResult.hasFace) {
        toast({
          title: 'No Face Detected',
          description: 'Please make sure your face is visible in the photo and try again.',
          variant: 'destructive'
        });
        return;
      }
      
      canvas.toBlob((blob) => {
        if (blob) {
          setPhotoBlob(blob);
          stopCamera();
          handlePunch();
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const uploadPhoto = async (blob: Blob): Promise<string | null> => {
    if (!user) return null;

    const userId = isPinAuthenticated ? (user as any).user_id : (user as any).id;

    try {
      const fileName = `${Date.now()}-punch.jpg`;
      const filePath = `${userId}/${fileName}`;

      const { error } = await supabase.storage
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

  const handlePunch = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      if (isPinAuthenticated) {
        const pin = getPin();
        const action = currentPunch ? 'out' : 'in';
        if (action === 'in' && (!selectedJob || !selectedCostCode)) {
          toast({
            title: 'Missing Information',
            description: 'Please select both a job and cost code before punching in.',
            variant: 'destructive'
          });
          return;
        }
        const res = await fetch(`${FUNCTION_BASE}/punch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
          body: JSON.stringify({
            pin,
            action,
            job_id: action === 'in' ? selectedJob : undefined,
            cost_code_id: action === 'in' ? selectedCostCode : undefined,
            latitude: location?.lat,
            longitude: location?.lng,
            photo_url: null,
          })
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || 'Edge punch failed');
        }
        setPhotoBlob(null);
        await loadFromEdge();
        toast({ title: action === 'in' ? 'Punched In' : 'Punched Out' });
        return;
      }

      // Upload photo if available
      let photoUrl: string | null = null;
      if (photoBlob) {
        photoUrl = await uploadPhoto(photoBlob);
        
        // If this is a PIN employee's first punch, set their avatar
        if (isPinAuthenticated && photoUrl) {
          await updatePinEmployeeAvatar(photoUrl);
        }
      }

      if (currentPunch) {
        await punchOut(photoUrl);
      } else {
        if (!selectedJob || !selectedCostCode) {
          toast({ title: 'Missing Information', description: 'Please select both a job and cost code before punching in.', variant: 'destructive' });
          return;
        }
        await punchIn(photoUrl);
      }

      setPhotoBlob(null);
      loadCurrentPunchStatus();

    } catch (error) {
      console.error('Error with punch:', error);
      toast({ title: 'Error', description: 'Failed to record punch. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const punchIn = async (photoUrl: string | null) => {
    if (!user) return;

    const userId = isPinAuthenticated ? (user as any).user_id : (user as any).id;

    // Create punch record
    const { error: punchError } = await supabase
      .from('punch_records')
      .insert({
        user_id: userId,
        job_id: selectedJob,
        cost_code_id: selectedCostCode,
        punch_type: 'punched_in',
        punch_time: new Date().toISOString(),
        latitude: location?.lat,
        longitude: location?.lng,
        photo_url: photoUrl
      });

    if (punchError) throw punchError;

    // Create current punch status
    const { error: statusError } = await supabase
      .from('current_punch_status')
      .insert({
        user_id: userId,
        job_id: selectedJob,
        cost_code_id: selectedCostCode,
        punch_in_time: new Date().toISOString(),
        punch_in_location_lat: location?.lat,
        punch_in_location_lng: location?.lng,
        punch_in_photo_url: photoUrl
      });

    if (statusError) throw statusError;

    toast({
      title: 'Punched In',
      description: `Successfully punched in at ${new Date().toLocaleTimeString()}`,
    });
  };

  const punchOut = async (photoUrl: string | null) => {
    if (!user || !currentPunch) return;

    const userId = isPinAuthenticated ? (user as any).user_id : (user as any).id;

    // Create punch out record
    const { error: punchError } = await supabase
      .from('punch_records')
      .insert({
        user_id: userId,
        job_id: currentPunch.job_id,
        cost_code_id: currentPunch.cost_code_id,
        punch_type: 'punched_out',
        punch_time: new Date().toISOString(),
        latitude: location?.lat,
        longitude: location?.lng,
        photo_url: photoUrl
      });

    if (punchError) throw punchError;

    // Deactivate current punch status
    const { error: statusError } = await supabase
      .from('current_punch_status')
      .update({ is_active: false })
      .eq('id', currentPunch.id);

    if (statusError) throw statusError;

    toast({
      title: 'Punched Out',
      description: `Successfully punched out at ${new Date().toLocaleTimeString()}`,
    });
  };

  const updatePinEmployeeAvatar = async (photoUrl: string) => {
    if (!isPinAuthenticated || !user) return;
    
    try {
      const { error } = await supabase
        .from('pin_employees')
        .update({ avatar_url: photoUrl })
        .eq('id', (user as any).user_id)
        .is('avatar_url', null); // Only update if no avatar exists yet
        
      if (error) {
        console.error('Error updating PIN employee avatar:', error);
      }
    } catch (error) {
      console.error('Error updating PIN employee avatar:', error);
    }
  };

  const selectedJobData = jobs.find(j => j.id === selectedJob);
  const selectedCostCodeData = costCodes.find(c => c.id === selectedCostCode);
  const currentJobData = currentPunch ? jobs.find(j => j.id === currentPunch.job_id) : null;
  const currentCostCodeData = currentPunch ? costCodes.find(c => c.id === currentPunch.cost_code_id) : null;

  // Background styling to match login screen
  const backgroundColor = loginSettings.background_color || '#f8fafc';
  const backgroundStyle = loginSettings.background_image_url
    ? {
        backgroundImage: `url(${loginSettings.background_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }
    : { backgroundColor };

  if (!user) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={backgroundStyle}
      >
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <Clock className="h-12 w-12 mx-auto mb-2 text-primary" />
            <h2 className="text-xl font-semibold">GST Punch Clock</h2>
            <p className="text-muted-foreground">This punch clock supports public PIN login.</p>
            <div className="space-y-2">
              <Button onClick={() => (window.location.href = '/punch-clock-login')} className="w-full">
                Continue with PIN Login
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = '/auth')} className="w-full">
                Sign In (Full Access)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen p-4"
      style={backgroundStyle}
    >
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{profile?.display_name || 'Employee'}</CardTitle>
                  <p className="text-sm text-muted-foreground capitalize">{profile?.role}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Current Time */}
        <Card>
          <CardContent className="p-6 text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="text-3xl font-bold mb-1">
              {currentTime.toLocaleTimeString()}
            </div>
            <div className="text-sm text-muted-foreground">
              {currentTime.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </CardContent>
        </Card>

        {/* Current Status */}
        {currentPunch ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Currently Punched In
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{currentJobData?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {currentCostCodeData?.code} - {currentCostCodeData?.description}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Punched in at {new Date(currentPunch.punch_in_time).toLocaleTimeString()}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Currently Punched Out
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Job</label>
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Select Cost Code</label>
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
            </CardContent>
          </Card>
        )}

        {/* Punch Button */}
        <div className="space-y-4">
          <Button
            onClick={startCamera}
            disabled={isLoading || (!currentPunch && (!selectedJob || !selectedCostCode))}
            className={`w-full h-16 text-lg font-semibold ${
              currentPunch 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            <Camera className="h-6 w-6 mr-2" />
            {isLoading ? 'Processing...' : currentPunch ? 'Punch Out' : 'Punch In'}
          </Button>
          
          {location && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Location captured
            </div>
          )}
        </div>

        {/* Camera Dialog */}
        <Dialog open={showCamera} onOpenChange={setShowCamera}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Take Photo</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={capturePhoto} 
                  disabled={isDetectingFace}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {isDetectingFace ? 'Detecting Face...' : 'Capture'}
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  Cancel
                </Button>
              </div>
              
              {faceDetectionResult && !faceDetectionResult.hasFace && (
                <div className="text-center p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 mx-auto mb-2 text-destructive" />
                  <p className="text-sm text-destructive font-medium">No face detected</p>
                  <p className="text-xs text-destructive/80 mt-1">
                    Make sure your face is clearly visible and try again
                  </p>
                </div>
              )}
              
              {faceDetectionResult && faceDetectionResult.hasFace && (
                <div className="text-center p-3 bg-green-100 border border-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 mx-auto mb-2 text-green-600" />
                  <p className="text-sm text-green-700 font-medium">Face detected successfully</p>
                  {faceDetectionResult.confidence && (
                    <p className="text-xs text-green-600 mt-1">
                      Confidence: {Math.round(faceDetectionResult.confidence * 100)}%
                    </p>
                  )}
                </div>
              )}
            </div>
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
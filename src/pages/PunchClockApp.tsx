import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, Camera, MapPin, User, Building, CheckCircle, AlertCircle, LogOut, Menu } from 'lucide-react';
import { usePunchClockAuth } from '@/contexts/PunchClockAuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
// transformers will be dynamically imported when needed

interface Job {
  id: string;
  name: string;
  address?: string;
  status?: string;
  company_id?: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  job_id?: string;
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

function PunchClockApp() {
  const { user, profile, signOut, isPinAuthenticated, loading } = usePunchClockAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [pinAllCostCodes, setPinAllCostCodes] = useState<CostCode[]>([]);
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
  const [punchSettings, setPunchSettings] = useState<any>({ 
    manual_photo_capture: true,
    cost_code_selection_timing: 'punch_in'
  });
  const [punchSettingsLoaded, setPunchSettingsLoaded] = useState(false);
  const [punchOutNote, setPunchOutNote] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDetectionInterval, setFaceDetectionInterval] = useState<NodeJS.Timeout | null>(null);
  const [isPunching, setIsPunching] = useState(false);
  const [latestPunchPhoto, setLatestPunchPhoto] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarUrl = () => {
    // Use profile avatar if available
    if (profile?.avatar_url) return profile.avatar_url;
    
    // Use latest punch photo (from current punch or previously loaded)
    if (currentPunch?.punch_in_photo_url) return currentPunch.punch_in_photo_url;
    if (latestPunchPhoto) return latestPunchPhoto;
    
    return undefined;
  };

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load login settings for background styling and punch clock settings
  useEffect(() => {
    loadLoginSettings();
    if (profile) {
      loadPunchSettings();
    } else {
      // If profile not yet available, keep settings as not loaded to avoid wrong UI
      setPunchSettingsLoaded(false);
    }
  }, [profile]);

  // Redirect if not authenticated (after loading completes)
  useEffect(() => {
    if (loading) return;
    const hasPinUser = !!localStorage.getItem('punch_clock_user');
    if (!user && !hasPinUser) {
      navigate('/punch-clock-login', { replace: true });
    }
  }, [loading, user, navigate]);

  // Load initial data
  useEffect(() => {
    if (user) {
      if (isPinAuthenticated) {
        loadFromEdge();
        getCurrentLocation();
      } else {
        loadJobs();
        loadCurrentPunchStatus();
        getCurrentLocation();
      }
    }
  }, [user, isPinAuthenticated, punchSettingsLoaded]);

  // Reload cost codes and punch settings when job selection changes
  useEffect(() => {
    if (selectedJob) {
      loadCostCodes(selectedJob);
      // Load punch settings based on the selected job's company (especially for PIN mode)
      if (isPinAuthenticated) {
        const job = jobs.find(j => j.id === selectedJob);
        if (job?.company_id) {
          loadPunchSettings(job.company_id);
        }
      }
    } else {
      setCostCodes([]);
    }
  }, [selectedJob, user, isPinAuthenticated, punchSettingsLoaded, jobs]);

  // Ensure selections stay valid when lists change
  useEffect(() => {
    if (selectedJob && !jobs.some(j => j.id === selectedJob)) {
      setSelectedJob('');
      setSelectedCostCode('');
    }
  }, [jobs, selectedJob]);

  useEffect(() => {
    if (selectedCostCode && !costCodes.some(c => c.id === selectedCostCode)) {
      setSelectedCostCode('');
    }
  }, [costCodes, selectedCostCode]);

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

  const loadPunchSettings = async (companyIdOverride?: string) => {
    try {
      // Determine company id: override > profile company > selected job company (PIN mode)
      let companyId = companyIdOverride || (profile as any)?.current_company_id;
      if (!companyId && isPinAuthenticated && selectedJob) {
        const job = jobs.find(j => j.id === selectedJob);
        companyId = job?.company_id as any;
      }
      console.log('Loading punch settings for company:', companyId);
      if (!companyId) {
        console.log('No company ID available yet for punch settings');
        // Defer until company id is available; don't mark settings as loaded yet
        return;
      }

      const { data, error } = await supabase
        .from('job_punch_clock_settings')
        .select('manual_photo_capture, cost_code_selection_timing, require_location')
        .eq('company_id', companyId)
        .is('job_id', null)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading punch settings:', error);
        return;
      }

      console.log('Punch settings query result:', data);
      
      if (data) {
        const newSettings = {
          manual_photo_capture: data.manual_photo_capture !== false,
          cost_code_selection_timing: (data as any).cost_code_selection_timing || 'punch_out',
          require_location: (data as any).require_location !== false
        };
        console.log('Setting punch settings to:', newSettings);
        setPunchSettings(newSettings);
        setPunchSettingsLoaded(true);
      } else {
        console.log('No punch settings found, defaulting to punch_out');
        setPunchSettings((prev: any) => ({ 
          ...prev, 
          cost_code_selection_timing: 'punch_out',
          require_location: true
        }));
        setPunchSettingsLoaded(true);
      }
    } catch (error) {
      console.error('Error loading punch settings:', error);
      // In case of error, avoid falsely requiring cost code; keep as not loaded
    }
  };

  const loadJobs = async () => {
    try {
      if (!user) return;
      
      const userId = isPinAuthenticated ? (user as any).user_id : (user as any).id;
      const companyId = (profile as any)?.current_company_id;
      
      // First, check if user has assigned jobs in their settings
      let assignedJobs: string[] | null = null;
      
      if (isPinAuthenticated) {
        const query = supabase
          .from('pin_employee_timecard_settings')
          .select('assigned_jobs')
          .eq('pin_employee_id', userId);
        
        if (companyId) {
          query.eq('company_id', companyId);
        }
        
        const { data: settings } = await query.maybeSingle();
        assignedJobs = settings?.assigned_jobs;
      } else {
        const query = supabase
          .from('employee_timecard_settings')
          .select('assigned_jobs')
          .eq('user_id', userId);
        
        if (companyId) {
          query.eq('company_id', companyId);
        }
        
        const { data: settings } = await query.maybeSingle();
        assignedJobs = settings?.assigned_jobs;
      }
      
      // Determine global access for regular users
      const hasGlobal = !isPinAuthenticated && (profile as any)?.has_global_job_access;

      // Load jobs based on access
      let data, error;
      if (hasGlobal) {
        const result = await supabase
          .from('jobs')
          .select('id, name, address, status, company_id')
          .in('status', ['active', 'planning'])
          .order('name');
        data = result.data;
        error = result.error;
      } else if (assignedJobs && assignedJobs.length > 0) {
        const result = await supabase
          .from('jobs')
          .select('id, name, address, status, company_id')
          .in('id', assignedJobs)
          .order('name');
        data = result.data;
        error = result.error;
      } else {
        // No global access and no specific assignments -> no jobs available
        setJobs([]);
        return;
      }

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadCostCodes = async (jobId?: string) => {
    try {
      if (!user || !jobId) {
        setCostCodes([]);
        return;
      }
      
      const userId = isPinAuthenticated ? (user as any).user_id : (user as any).id;
      const companyId = (profile as any)?.current_company_id;
      
      // For PIN-authenticated users: filter client-side from edge data
      if (isPinAuthenticated) {
        const filtered = pinAllCostCodes.filter(cc => cc.job_id === jobId);
        setCostCodes(filtered);
        return;
      }
      
      // For regular authenticated users
      const { data: settings } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_cost_codes')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .maybeSingle();
      
      const assignedCostCodes = settings?.assigned_cost_codes || [];
      
      // Determine global access for regular users
      const hasGlobal = (profile as any)?.has_global_job_access;

      // Load cost codes for the selected job
      let data, error;
      if (hasGlobal) {
        const result = await supabase
          .from('cost_codes')
          .select('id, code, description, job_id')
          .eq('is_active', true)
          .eq('job_id', jobId)
          .order('code');
        data = result.data;
        error = result.error;
      } else if (assignedCostCodes && assignedCostCodes.length > 0) {
        const result = await supabase
          .from('cost_codes')
          .select('id, code, description, job_id')
          .eq('is_active', true)
          .eq('job_id', jobId)
          .in('id', assignedCostCodes)
          .order('code');
        data = result.data;
        error = result.error;
      } else {
        // No global access and no assigned codes -> none available
        setCostCodes([]);
        return;
      }

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
      
      // Load latest punch photo for avatar - check both time_cards and punch_records
      const { data: latestTimeCard } = await supabase
        .from('time_cards')
        .select('punch_out_photo_url, punch_in_photo_url')
        .eq('user_id', userId)
        .order('punch_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const { data: latestPunchRecord } = await supabase
        .from('punch_records')
        .select('photo_url, punch_time')
        .eq('user_id', userId)
        .not('photo_url', 'is', null)
        .order('punch_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Use the most recent photo from either source
      let photoUrl = null;
      if (latestTimeCard) {
        photoUrl = latestTimeCard.punch_out_photo_url || latestTimeCard.punch_in_photo_url;
      }
      if (latestPunchRecord?.photo_url) {
        // If we have a punch record photo and either no timecard photo or the punch record is newer
        if (!photoUrl) {
          photoUrl = latestPunchRecord.photo_url;
        }
      }
      
      if (photoUrl) {
        setLatestPunchPhoto(photoUrl);
      }
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
      const res = await fetch(`${FUNCTION_BASE}/init?pin=${pin}`, { 
        headers: { 
          apikey: ANON_KEY, 
          Authorization: `Bearer ${ANON_KEY}` 
        } 
      });
      const json = await res.json();
      if (res.ok) {
        // Edge function returns pre-filtered data based on user permissions
        const jobsFromEdge = json.jobs || [];
        const costCodesFromEdge = json.cost_codes || [];
        setJobs(jobsFromEdge);
        setPinAllCostCodes(costCodesFromEdge);
        
        // If only one job is available, auto-select it
        if (!selectedJob && jobsFromEdge.length === 1) {
          setSelectedJob(jobsFromEdge[0].id);
        }
        
        // Initialize visible cost codes filtered by selected job (if any)
        if (selectedJob) {
          setCostCodes(costCodesFromEdge.filter((cc: any) => cc.job_id === selectedJob));
        } else {
          setCostCodes([]);
        }
        
        setCurrentPunch(json.current_punch || null);
        console.log('Edge data loaded - jobs:', jobsFromEdge.length, 'cost codes:', costCodesFromEdge.length, 'current punch:', json.current_punch);
      } else {
        console.error('Edge init error:', json);
      }
    } catch (e) { 
      console.error('Edge init exception', e); 
    }
  };

  const getCurrentLocation = (showError = false) => {
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
          // Only show error toast if explicitly requested (e.g., during punch in/out)
          if (showError) {
            let errorMessage = 'Could not get your location. ';
            
            switch(error.code) {
              case error.PERMISSION_DENIED:
                errorMessage += 'Please allow location access in your browser settings.';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage += 'Location information is unavailable.';
                break;
              case error.TIMEOUT:
                errorMessage += 'Location request timed out. Please try again.';
                break;
              default:
                errorMessage += 'Please enable location services.';
            }
            
            toast({
              title: 'Location Error',
              description: errorMessage,
              variant: 'destructive'
            });
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else if (showError) {
      toast({
        title: 'Location Not Supported',
        description: 'Your browser does not support location services.',
        variant: 'destructive'
      });
    }
  };

  const startCamera = async () => {
    console.log('startCamera called - checking conditions');
    console.log('currentPunch:', currentPunch);
    console.log('selectedJob:', selectedJob);
    console.log('selectedCostCode:', selectedCostCode);
    
    // Try to get location with error feedback when starting punch
    getCurrentLocation(true);
    
    // First open the dialog, then start camera
    setShowCamera(true);
    setIsCapturing(false);
    setFaceDetectionResult(null);
    
    // Wait a bit for the dialog to render the video element
    setTimeout(async () => {
      try {
        console.log('Requesting camera permissions...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' } 
        });
        console.log('Camera stream obtained:', stream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log('Camera stream set to video element');
          
          // Start automatic face detection after video loads
          videoRef.current.onloadedmetadata = () => {
            startFaceDetection();
          };
        } else {
          console.error('videoRef.current is still null after timeout');
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setShowCamera(false);
        toast({
          title: 'Camera Error',
          description: 'Could not access camera. Please enable camera permissions.',
          variant: 'destructive'
        });
      }
    }, 100);
  };

  const startFaceDetection = () => {
    if (faceDetectionInterval) {
      clearInterval(faceDetectionInterval);
    }
    
    const interval = setInterval(async () => {
      // Check if already capturing or punching to prevent double submission
      if (!videoRef.current || !canvasRef.current || isCapturing || isPunching) return;
      
      try {
        await detectAndCapture();
      } catch (error) {
        console.error('Face detection error:', error);
      }
    }, 500); // Check every 500ms for faster response
    
    setFaceDetectionInterval(interval);
  };

  const detectAndCapture = async () => {
    // Guard against concurrent operations
    if (!videoRef.current || !canvasRef.current || isCapturing || isPunching) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    // Get image data for face detection
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Detect face
    setIsDetectingFace(true);
    const faceResult = await detectFace(imageData);
    setFaceDetectionResult(faceResult);
    setIsDetectingFace(false);

    // Only auto-capture if manual photo capture is disabled
    if (!punchSettings.manual_photo_capture && faceResult.hasFace && !isPunching && !isCapturing) {
      // Immediately set flags to prevent double submission
      setIsCapturing(true);
      setIsPunching(true);
      
      // Clear the detection interval immediately
      if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
        setFaceDetectionInterval(null);
      }
      
      // Capture the photo
      canvas.toBlob((blob) => {
        if (blob) {
          setPhotoBlob(blob);
          stopCamera();
          handlePunch(blob);
        } else {
          // Reset flags if capture failed
          setIsCapturing(false);
          setIsPunching(false);
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const detectFace = async (imageData: string): Promise<{ hasFace: boolean; confidence?: number }> => {
    try {
      // Use MediaPipe FaceMesh for faster, more accurate face detection
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      
      // Lazy-init and cache detector
      if (!(window as any).__cachedFaceDetector__) {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        (window as any).__cachedFaceDetector__ = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          runningMode: "IMAGE",
          numFaces: 1
        });
      }
      const detector = (window as any).__cachedFaceDetector__;

      // Convert data URL to HTMLImageElement
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageData;
      });

      // Run face detection
      const results = detector.detect(img);
      
      const hasFace = results.faceLandmarks && results.faceLandmarks.length > 0;
      
      return {
        hasFace,
        confidence: hasFace ? 0.9 : 0 // MediaPipe doesn't provide confidence scores
      };
    } catch (error) {
      console.error('MediaPipe face detection error, falling back to browser API:', error);
      
      // Fallback to FaceDetector API if available
      try {
        if ('FaceDetector' in window) {
          const detector = new (window as any).FaceDetector();
          
          // Convert data URL to ImageData
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageData;
          });
          
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          
          const faces = await detector.detect(img);
          return {
            hasFace: faces.length > 0,
            confidence: faces.length > 0 ? 0.8 : 0
          };
        }
      } catch (fallbackError) {
        console.error('Browser FaceDetector fallback failed:', fallbackError);
      }
      
      // Final fallback: simple image analysis
      return await simpleFaceDetection(imageData);
    }
  };

  const simpleFaceDetection = async (imageData: string): Promise<{ hasFace: boolean; confidence?: number }> => {
    try {
      // Convert to canvas for pixel analysis
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageData;
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(img.width, 320); // Reduce size for faster processing
      canvas.height = Math.min(img.height, 240);
      const ctx = canvas.getContext('2d');
      if (!ctx) return { hasFace: true, confidence: 1 };
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Simple heuristic: look for skin-tone pixels in face region (upper third)
      let skinPixels = 0;
      let totalPixels = 0;
      const faceRegionStartY = Math.floor(canvas.height * 0.1);
      const faceRegionEndY = Math.floor(canvas.height * 0.6);
      
      for (let y = faceRegionStartY; y < faceRegionEndY; y++) {
        for (let x = Math.floor(canvas.width * 0.2); x < Math.floor(canvas.width * 0.8); x++) {
          const i = (y * canvas.width + x) * 4;
          const r = pixelData.data[i];
          const g = pixelData.data[i + 1];
          const b = pixelData.data[i + 2];
          
          // Simple skin tone detection
          if (r > 80 && g > 50 && b > 40 && r > b && r - g < 40) {
            skinPixels++;
          }
          totalPixels++;
        }
      }
      
      const skinRatio = skinPixels / totalPixels;
      const hasFace = skinRatio > 0.1; // At least 10% skin-tone pixels
      
      return {
        hasFace,
        confidence: hasFace ? Math.min(skinRatio * 3, 0.8) : 0
      };
    } catch (error) {
      console.error('Simple face detection failed:', error);
      return { hasFace: true, confidence: 1 };
    }
  };

  const stopCamera = () => {
    // Clear face detection interval
    if (faceDetectionInterval) {
      clearInterval(faceDetectionInterval);
      setFaceDetectionInterval(null);
    }
    
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
    setIsCapturing(false);
    setFaceDetectionResult(null);
  };

  const captureNow = () => {
    // Check if face is detected before allowing capture
    if (!faceDetectionResult?.hasFace) {
      toast({
        title: 'No Face Detected / No se detectó rostro',
        description: 'Please position your face within the outlined area before taking a photo. / Por favor, posicione su rostro dentro del área delineada antes de tomar una foto.',
        variant: 'destructive'
      });
      return;
    }

    // Prevent multiple captures or punches
    if (!videoRef.current || !canvasRef.current || isCapturing || isPunching) return;
    
    setIsCapturing(true);
    setIsPunching(true);
    
    // Clear face detection interval
    if (faceDetectionInterval) {
      clearInterval(faceDetectionInterval);
      setFaceDetectionInterval(null);
    }
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { 
      setIsCapturing(false); 
      setIsPunching(false);
      return; 
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        setPhotoBlob(blob);
        stopCamera();
        handlePunch(blob);
      } else {
        setIsCapturing(false);
        setIsPunching(false);
      }
    }, 'image/jpeg', 0.8);
  };

  const uploadPhoto = async (blob: Blob): Promise<string | null> => {
    if (!user) {
      console.error('No user - cannot upload photo');
      return null;
    }

    try {
      // Always try Edge Function first for consistent permissions (PIN or regular auth)
      const toBase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.includes(',') ? res.split(',')[1] : res;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(b);
      });

      const base64 = await toBase64(blob);
      const pin = isPinAuthenticated ? getPin() : null;

      // Get current session token for regular authenticated users
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || undefined;

      let res: Response | null = null;
      try {
        res = await fetch(`${FUNCTION_BASE}/upload-photo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: ANON_KEY,
            // Prefer user token when available; fallback to anon for PIN mode
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : { Authorization: `Bearer ${ANON_KEY}` }),
          },
          body: JSON.stringify({ pin, image: base64 }),
        });
      } catch (e) {
        console.warn('Edge upload request failed to send:', e);
      }

      if (res && res.ok) {
        const json = await res.json();
        return json.publicUrl || null;
      }

      // Fallback: upload via client SDK (for cases where edge function rejects)
      const userId = isPinAuthenticated ? (user as any).user_id : (user as any).id;
      const fileName = `${userId}-${Date.now()}.jpg`;
      const filePath = `punch-photos/${fileName}`;

      const { error } = await supabase.storage
        .from('punch-photos')
        .upload(filePath, blob);

      if (error) {
        console.error('Storage upload error (fallback):', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('punch-photos')
        .getPublicUrl(filePath);

      return urlData.publicUrl || null;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  const handlePunch = async (capturedBlob?: Blob) => {
    // Guard against concurrent submissions at the very start
    if (!user || isPunching || isLoading) {
      console.log('Punch blocked - already in progress');
      return;
    }

    try {
      setIsLoading(true);
      setIsPunching(true);

      // Upload photo if available (for all authentication types)
      let photoUrl: string | null = null;
      const blobToUpload = capturedBlob ?? photoBlob;
      if (blobToUpload) {
        console.log('Uploading photo, blob size:', blobToUpload.size);
        photoUrl = await uploadPhoto(blobToUpload);
        console.log('Photo upload result:', photoUrl);
        
        if (!photoUrl) {
          console.error('Photo upload failed - photoUrl is null');
          toast({
            title: 'Photo Upload Failed',
            description: 'Your punch photo could not be uploaded. Please try again or contact your manager.',
            variant: 'destructive'
          });
          // Don't proceed with punch if photo upload failed
          setIsLoading(false);
          setIsPunching(false);
          setPhotoBlob(null);
          return;
        }
        
        // If this is a PIN employee's first punch with face detected, set their avatar
        if (isPinAuthenticated && photoUrl && faceDetectionResult?.hasFace) {
          await updatePinEmployeeAvatar(photoUrl);
        }
      } else {
        console.log('No photoBlob available - photo not captured');
      }

      if (isPinAuthenticated) {
        const pin = getPin();
        const action = currentPunch ? 'out' : 'in';
        
        // Check required fields based on timing setting
        if (action === 'in' && !selectedJob) {
          toast({
            title: 'Missing Information',
            description: 'Please select a job before punching in.',
            variant: 'destructive'
          });
          setIsLoading(false);
          setIsPunching(false);
          return;
        }

        // Block punch if settings haven't loaded yet
        if (!punchSettingsLoaded) {
          toast({
            title: 'Loading Settings',
            description: 'Please wait while punch clock settings load...',
            variant: 'destructive'
          });
          setIsLoading(false);
          setIsPunching(false);
          return;
        }

        // Validate location requirement for punch in
        if (action === 'in' && punchSettings.require_location && !location) {
          toast({
            title: 'Location Required',
            description: 'Please enable location access to punch in. This job requires location tracking.',
            variant: 'destructive'
          });
          setIsLoading(false);
          setIsPunching(false);
          return;
        }
        
        // Validate cost code for punch in
        if (action === 'in' && punchSettings.cost_code_selection_timing === 'punch_in' && !selectedCostCode) {
          toast({
            title: 'Missing Information',
            description: 'Please select a cost code before punching in.',
            variant: 'destructive'
          });
          setIsLoading(false);
          setIsPunching(false);
          return;
        }

        // Validate cost code for punch out
        if (action === 'out' && punchSettings.cost_code_selection_timing === 'punch_out' && !selectedCostCode) {
          toast({
            title: 'Missing Information',
            description: 'Please select your daily task before punching out.',
            variant: 'destructive'
          });
          setIsLoading(false);
          setIsPunching(false);
          return;
        }

        // Add admin alert if photo failed to upload
        const photoUploadNote = photoBlob && !photoUrl ? 'ADMIN ALERT: Photo upload failed for this punch' : undefined;
        const combinedNotes = currentPunch 
          ? (photoUploadNote ? `${punchOutNote || ''}\n${photoUploadNote}`.trim() : punchOutNote)
          : photoUploadNote;

        // Convert blob to base64 for edge function
        let imageBase64: string | undefined;
        if (blobToUpload && !photoUrl) {
          const toBase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              const base64 = res.includes(',') ? res.split(',')[1] : res;
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(b);
          });
          imageBase64 = await toBase64(blobToUpload);
        }

        // Prevent duplicate punch operations
        const res = await fetch(`${FUNCTION_BASE}/punch`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'apikey': ANON_KEY, 
            'Authorization': `Bearer ${ANON_KEY}` 
          },
          body: JSON.stringify({
            pin,
            action,
            job_id: action === 'in' ? selectedJob : undefined,
            cost_code_id: action === 'out' ? selectedCostCode : (action === 'in' && punchSettingsLoaded && punchSettings.cost_code_selection_timing === 'punch_in' ? selectedCostCode : undefined),
            latitude: location?.lat,
            longitude: location?.lng,
            photo_url: photoUrl,
            image: imageBase64, // Send base64 image if photo wasn't pre-uploaded
            notes: combinedNotes,
            timezone_offset_minutes: new Date().getTimezoneOffset(),
          })
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          const errorMessage = j.error || 'Failed to record punch';
          
          // Handle specific error cases
          if (errorMessage.includes('already punched in')) {
            toast({
              title: 'Already Punched In',
              description: 'You are already punched in. Please punch out first.',
              variant: 'destructive'
            });
            // Refresh the data to sync state
            await loadFromEdge();
            setIsLoading(false);
            setIsPunching(false);
            return;
          } else if (errorMessage.includes('not currently punched in')) {
            toast({
              title: 'Not Punched In',
              description: 'You are not currently punched in. Please punch in first.',
              variant: 'destructive'
            });
            // Refresh the data to sync state
            await loadFromEdge();
            setIsLoading(false);
            setIsPunching(false);
            return;
          } else if (errorMessage.includes('Photo is required')) {
            toast({
              title: 'Photo Required',
              description: 'Please take a photo before punching. Tap the camera icon to capture a photo.',
              variant: 'destructive'
            });
            setIsLoading(false);
            setIsPunching(false);
            return;
          } else if (errorMessage.includes('Location is required')) {
            toast({
              title: 'Location Required',
              description: 'Location access is required for this job. Please enable location services.',
              variant: 'destructive'
            });
            setIsLoading(false);
            setIsPunching(false);
            return;
          }
          
          throw new Error(errorMessage);
        }

        // Get updated punch status from response
        const result = await res.json();
        if (result.current_punch !== undefined) {
          setCurrentPunch(result.current_punch);
          console.log('Updated current punch from response:', result.current_punch);
        }
        
        // Clear form data
        setPhotoBlob(null);
        setPunchOutNote('');
        
        toast({ title: action === 'in' ? 'Punched In' : 'Punched Out' });
        return;
      }

      if (currentPunch) {
        await punchOut(photoUrl);
      } else {
        // Only validate cost code requirement if settings have loaded
        const requiresCostCode = punchSettingsLoaded && punchSettings.cost_code_selection_timing === 'punch_in';
        if (!selectedJob || (requiresCostCode && !selectedCostCode)) {
          toast({ 
            title: 'Missing Information', 
            description: requiresCostCode 
              ? 'Please select both a job and cost code before punching in.' 
              : 'Please select a job before punching in.', 
            variant: 'destructive' 
          });
          setIsLoading(false);
          setIsPunching(false);
          return;
        }
        await punchIn(photoUrl);
      }

      setPhotoBlob(null);
      setPunchOutNote('');

    } catch (error) {
      console.error('Error with punch:', error);
      toast({ title: 'Error', description: (error instanceof Error ? error.message : 'Failed to record punch. Please try again.'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setIsPunching(false);
      setIsCapturing(false);
    }
  };

  const punchIn = async (photoUrl: string | null) => {
    if (!user) return;

    const userId = isPinAuthenticated ? (user as any).user_id : (user as any).id;
    
    // Use cost code if timing is punch_in, otherwise null (only if settings loaded)
    const costCodeToUse = punchSettingsLoaded && punchSettings.cost_code_selection_timing === 'punch_in' ? selectedCostCode : null;

    // Create punch record
    const { error: punchError } = await supabase
      .from('punch_records')
      .insert({
        user_id: userId,
        company_id: (profile as any)?.current_company_id,
        job_id: selectedJob,
        cost_code_id: costCodeToUse,
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
        cost_code_id: costCodeToUse,
        punch_in_time: new Date().toISOString(),
        punch_in_location_lat: location?.lat,
        punch_in_location_lng: location?.lng,
        punch_in_photo_url: photoUrl
      });

    if (statusError) throw statusError;
  };

  const punchOut = async (photoUrl: string | null) => {
    if (!user || !currentPunch) return;

    const userId = isPinAuthenticated ? (user as any).user_id : (user as any).id;
    
    // Use selected cost code if timing is punch_out, otherwise use the one from punch in (only if settings loaded)
    const costCodeToUse = punchSettingsLoaded && punchSettings.cost_code_selection_timing === 'punch_out' 
      ? selectedCostCode 
      : currentPunch.cost_code_id;

    // Create punch out record
    const { error: punchError } = await supabase
      .from('punch_records')
      .insert({
        user_id: userId,
        company_id: profile?.company_id,
        job_id: currentPunch.job_id,
        cost_code_id: costCodeToUse,
        punch_type: 'punched_out',
        punch_time: new Date().toISOString(),
        latitude: location?.lat,
        longitude: location?.lng,
        photo_url: photoUrl,
        notes: punchOutNote
      });

    if (punchError) throw punchError;

    // Deactivate current punch status
    const { error: statusError } = await supabase
      .from('current_punch_status')
      .update({ is_active: false })
      .eq('id', currentPunch.id);

    if (statusError) throw statusError;
  };

  const updatePinEmployeeAvatar = async (photoUrl: string) => {
    if (!isPinAuthenticated || !user) return;
    
    try {
      const { error } = await supabase
        .from('pin_employees')
        .update({ avatar_url: photoUrl })
        .eq('id', (user as any).user_id)
        .is('avatar_url', null); // Only update if no avatar exists yet
        
      if (error) throw error;
      
      // Also try to update regular profile if it exists
      await supabase
        .from('profiles')
        .update({ avatar_url: photoUrl })
        .eq('user_id', (user as any).user_id);
        
      console.log('Avatar updated successfully');
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
              <Button onClick={() => navigate('/punch-clock-login')} className="w-full">
                Continue with PIN Login
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
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/employee-dashboard')}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={getAvatarUrl()} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg hover:underline">{profile?.display_name || 'Employee'}</CardTitle>
                  <p className="text-sm text-muted-foreground capitalize">{profile?.role}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/employee-dashboard')}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Current Time */}
        <Card>
          <CardContent className="p-6 text-center">
            <Clock className={`h-8 w-8 mx-auto mb-2 ${currentPunch ? 'text-success' : 'text-destructive'}`} />
            <div className="text-lg font-semibold mb-2">
              {currentPunch ? (
                <Badge variant="success" className="text-sm">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Working
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-sm">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Working
                </Badge>
              )}
            </div>
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
              {punchSettings.cost_code_selection_timing === 'punch_in' && currentCostCodeData && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {currentCostCodeData?.code} - {currentCostCodeData?.description}
                  </Badge>
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Punched in at {new Date(currentPunch.punch_in_time).toLocaleTimeString()}
              </div>

              {/* Show cost code selector at punch out if setting is punch_out */}
              {punchSettings.cost_code_selection_timing === 'punch_out' && (
                <div className="space-y-2 mt-4">
                  <label className="text-sm font-medium">Select Daily Task</label>
                  <Select value={selectedCostCode} onValueChange={setSelectedCostCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a daily task" />
                    </SelectTrigger>
                    <SelectContent>
                      {costCodes.filter(code => code.id && code.id.trim()).map((code) => (
                        <SelectItem key={code.id} value={code.id}>
                          {code.code} - {code.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                    {jobs.filter(job => job.id && job.id.trim()).map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Show cost code selector at punch in ONLY if setting is punch_in */}
              {punchSettingsLoaded && punchSettings.cost_code_selection_timing === 'punch_in' && selectedJob && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Cost Code</label>
                  <Select value={selectedCostCode} onValueChange={setSelectedCostCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a cost code" />
                    </SelectTrigger>
                    <SelectContent>
                      {costCodes.filter(code => code.id && code.id.trim()).map((code) => (
                        <SelectItem key={code.id} value={code.id}>
                          {code.code} - {code.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Note Section for Punch Out */}
        {currentPunch && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Note (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any notes about your work today..."
                value={punchOutNote}
                onChange={(e) => setPunchOutNote(e.target.value)}
                className="min-h-[80px]"
              />
            </CardContent>
          </Card>
        )}

        {/* Punch Button */}
        <div className="space-y-4">
          <Button
            onClick={() => {
              console.log('Punch button clicked');
              const requiresCostCode = punchSettingsLoaded && (
                (!currentPunch && punchSettings.cost_code_selection_timing === 'punch_in') ||
                (currentPunch && punchSettings.cost_code_selection_timing === 'punch_out')
              );
              const isDisabled = isLoading || !punchSettingsLoaded || (!currentPunch && !selectedJob) || (requiresCostCode && !selectedCostCode);
              console.log('Button disabled?', isDisabled);
              if (!isDisabled) startCamera();
            }}
            disabled={
              isLoading || 
              !punchSettingsLoaded ||
              (!currentPunch && !selectedJob) || 
              // Punch in: only require cost code if setting is 'punch_in' and settings loaded
              (!currentPunch && punchSettingsLoaded && punchSettings.cost_code_selection_timing === 'punch_in' && !selectedCostCode) ||
              // Punch out: only require cost code if setting is 'punch_out' and settings loaded
              (currentPunch && punchSettingsLoaded && punchSettings.cost_code_selection_timing === 'punch_out' && !selectedCostCode)
            }
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Take Photo</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-80 rounded-lg object-cover"
                />
                {/* Face positioning guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-64 border-2 border-white border-dashed rounded-full opacity-50 flex items-center justify-center">
                    <div className="text-white text-xs text-center">
                      Position your face<br />within this oval
                    </div>
                  </div>
                </div>
                
                {/* Detection status overlay */}
                <div className="absolute top-4 left-4 right-4">
                  {isDetectingFace && (
                    <div className="bg-blue-500/80 text-white px-3 py-2 rounded-lg text-sm">
                      Detecting face... / Detectando rostro...
                    </div>
                  )}
                  {faceDetectionResult && !isCapturing && (
                    <div className={`px-3 py-2 rounded-lg text-sm ${
                      faceDetectionResult.hasFace 
                        ? 'bg-green-500/80 text-white' 
                        : 'bg-red-500/80 text-white'
                    }`}>
                      {faceDetectionResult.hasFace 
                        ? punchSettings.manual_photo_capture 
                          ? '✓ Face detected - Ready to capture / Rostro detectado - Listo para capturar' 
                          : '✓ Face detected - Capturing... / Rostro detectado - Capturando...'
                        : '✗ No face detected - Position yourself in the oval / No se detectó rostro - Posiciónese en el óvalo'}
                    </div>
                  )}
                  {isCapturing && (
                    <div className="bg-green-600/80 text-white px-3 py-2 rounded-lg text-sm">
                      Capturing photo... / Capturando foto...
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between">
                <Button variant="outline" onClick={stopCamera}>
                  Cancel / Cancelar
                </Button>
                {punchSettings.manual_photo_capture && (
                  <Button 
                    onClick={captureNow} 
                    disabled={isCapturing || !faceDetectionResult?.hasFace}
                    className={!faceDetectionResult?.hasFace ? 'opacity-50' : ''}
                  >
                    Take Photo / Tomar Foto
                  </Button>
                )}
              </div>
            </div>
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default PunchClockApp;
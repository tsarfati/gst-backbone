import { useState, useRef, useCallback, useEffect } from 'react';
import { getStoragePathForDb } from '@/utils/storageUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, CheckCircle, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useReceipts } from '@/contexts/ReceiptContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
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

interface Vendor {
  id: string;
  name: string;
}

// Utility: timeout any async op to prevent indefinite "Processing..." state
async function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  let timeoutId: number;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]) as T;
  } finally {
    clearTimeout(timeoutId!);
  }
}

export function PMReceiptScanner() {
  const { user } = useAuth();
  const { addReceipts, codeReceipt } = useReceipts();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { user: punchUser } = useAuth();

  const pmLocal = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('pm_mobile_user') || 'null') : null;

  const effectiveUserId: string | null =
    (user as any)?.id || (punchUser as any)?.id || (punchUser as any)?.user_id || pmLocal?.user_id || null;

  const effectiveCompanyId: string | null = currentCompany?.id || pmLocal?.company_id || null;

  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  
  // Pre-selection fields for PM
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedCostCode, setSelectedCostCode] = useState('');
  
  // Receipt form fields
  const [selectedVendor, setSelectedVendor] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data when component mounts
  const loadData = useCallback(async () => {
    try {
      console.log('PM Receipt Scanner - Loading data...', { userId: effectiveUserId, companyId: effectiveCompanyId });
      
      // Determine job access (fallback to false if no user)
      let profileData: { has_global_job_access?: boolean } | null = null;
      let profileError: any = null;
      if (effectiveUserId) {
        const { data, error } = await supabase
          .from('profiles')
          .select('has_global_job_access')
          .eq('user_id', effectiveUserId)
          .maybeSingle();
        profileData = data;
        profileError = error;
      }

      console.log('PM Receipt Scanner - Profile data:', { profileData, profileError, hasGlobalAccess: profileData?.has_global_job_access });

      let jobsData: Job[] = [];
      if (profileData?.has_global_job_access) {
        // Global access: query ALL companies user has access to
        const { data: userCompanies } = effectiveUserId
          ? await supabase.rpc('get_user_companies', { _user_id: effectiveUserId })
          : { data: [] };
        
        const companyIds = (userCompanies || []).map((uc: any) => uc.company_id);
        console.log('PM Receipt Scanner - User companies:', { companyIds });

        if (companyIds.length > 0) {
          // Try active jobs first across all companies
          const { data, error: jobsError } = await supabase
            .from('jobs')
            .select('id, name, address')
            .in('company_id', companyIds)
            .eq('is_active', true)
            .order('name');
          console.log('PM Receipt Scanner - Global jobs (active) query:', { count: data?.length, jobsError });
          jobsData = (data || []) as Job[];

          // Fallback: fetch all jobs if none marked active
          if (!jobsData.length) {
            const { data: allData, error: allErr } = await supabase
              .from('jobs')
              .select('id, name, address')
              .in('company_id', companyIds)
              .order('name');
            console.log('PM Receipt Scanner - Global jobs (fallback all) query:', { count: allData?.length, allErr });
            jobsData = (allData || []) as Job[];
          }
        }
      } else {
        // Specific job access: fetch job ids from user_job_access across ALL companies
        const { data: access, error: accessError } = effectiveUserId
          ? await supabase
              .from('user_job_access')
              .select('job_id')
              .eq('user_id', effectiveUserId)
          : ({ data: [], error: null } as any);
        
        console.log('PM Receipt Scanner - User job access:', { accessCount: access?.length, accessError, userId: effectiveUserId });
        
        const jobIds = (access || []).map((a: any) => a.job_id);
        if (jobIds.length) {
          // Try active first (no company filter - across all companies)
          const { data, error: jobsError } = await supabase
            .from('jobs')
            .select('id, name, address')
            .in('id', jobIds)
            .eq('is_active', true)
            .order('name');
          console.log('PM Receipt Scanner - Specific jobs (active) query:', { count: data?.length, jobsError, jobIds });
          let jobsSpecific = (data || []) as Job[];
          
          if (!jobsSpecific.length) {
            const { data: allSpecific, error: allErr } = await supabase
              .from('jobs')
              .select('id, name, address')
              .in('id', jobIds)
              .order('name');
            console.log('PM Receipt Scanner - Specific jobs (fallback all) query:', { count: allSpecific?.length, allErr });
            jobsSpecific = (allSpecific || []) as Job[];
          }
          jobsData = jobsSpecific;
        } else {
          console.log('PM Receipt Scanner - No job IDs found in user_job_access');
          jobsData = [];
        }
      }
      
      console.log('PM Receipt Scanner - Jobs loaded:', jobsData?.length || 0, jobsData);
      setJobs(jobsData);

      // Vendors (unchanged)
      const { data: vendorsData } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (vendorsData) setVendors(vendorsData);

      // Clear cost codes until a job is selected
      setCostCodes([]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, [effectiveUserId, effectiveCompanyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load cost codes for selected job: only Material, Equipment, Other
  useEffect(() => {
    const fetchCodes = async () => {
      if (!selectedJob) {
        setCostCodes([]);
        return;
      }
      const { data } = await supabase
        .from('cost_codes')
        .select('id, code, description')
        .eq('job_id', selectedJob)
        .eq('is_active', true)
        .eq('is_dynamic_group', false)
        .in('type', ['material','equipment','other'])
        .order('code');
      setCostCodes((data || []) as CostCode[]);
    };
    fetchCodes();
  }, [selectedJob]);

  const startCamera = async () => {
    setShowCamera(true);
    
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
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

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
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
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    setCapturedImage(imageData);
    stopCamera();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
    };
    reader.readAsDataURL(file);
  };

  const submitReceipt = async () => {
    if (!capturedImage) {
      toast({
        title: 'Photo Required',
        description: 'Please capture or upload a photo of the receipt.',
        variant: 'destructive'
      });
      return;
    }
    if (!selectedJob) {
      toast({
        title: 'Job Required',
        description: 'Please select a job before submitting the receipt.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    try {
// Convert captured image to blob
const response = await withTimeout(fetch(capturedImage), 5000, 'Image read');
const blob = await response.blob();

// Create file for upload
const fileName = `receipt-${Date.now()}.jpg`;
const file = new File([blob], fileName, { type: 'image/jpeg' });
      
      // Use the ReceiptContext's addReceipts method for proper database storage
      const fileList = Object.create(FileList.prototype);
      Object.defineProperty(fileList, '0', { value: file });
      Object.defineProperty(fileList, 'length', { value: 1 });
      
      await addReceipts(fileList as FileList);
      // Check if receipt should be coded or go to uncoded
      const isComplete = selectedJob && selectedCostCode && receiptAmount;
      
      if (isComplete) {
        // Code the receipt immediately
        setTimeout(() => {
          const receiptId = `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const selectedJobData = jobs.find(j => j.id === selectedJob);
          const selectedCostCodeData = costCodes.find(c => c.id === selectedCostCode);
          
          if (selectedJobData && selectedCostCodeData) {
            const jobName = selectedJobData.name;
            const costCodeName = `${selectedCostCodeData.code} - ${selectedCostCodeData.description}`;
            const codedBy = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || 'Project Manager';
            
            codeReceipt(receiptId, jobName, costCodeName, codedBy, selectedVendor, receiptAmount);
          }
        }, 500);

        toast({
          title: 'Receipt Coded Successfully',
          description: 'Receipt has been processed and added to coded receipts.',
        });
      } else {
        // Upload directly to database with proper company_id
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentCompany?.id || 'no-company'}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const fileUrl = getStoragePathForDb('receipts', fileName);

        const { error: insertError } = await supabase
          .from('receipts')
          .insert({
            company_id: currentCompany?.id || user?.id,
            created_by: user?.id,
            file_name: file.name,
            file_url: fileUrl,
            file_size: file.size,
            status: 'uncoded',
            vendor_name: vendorName || null,
            amount: parseFloat(receiptAmount) || null,
            receipt_date: receiptDate || null,
            payment_method: paymentMethod || null,
            notes: notes || null
          });

        if (insertError) throw insertError;
        
        toast({
          title: 'Receipt Uploaded',
          description: 'Receipt has been added to uncoded receipts for later processing.',
        });
      }

      resetForm();
      
    } catch (error) {
      console.error('Error saving receipt:', error);
      toast({
        title: 'Upload Error',
        description: 'Failed to upload receipt. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

const enhanceReceiptImage = async (imageBlob: Blob): Promise<Blob> => {
  try {
    const formData = new FormData();
    formData.append('image', imageBlob);

    const { data, error } = await withTimeout(
      supabase.functions.invoke('enhance-receipt', { body: formData }),
      15000,
      'Image enhancement'
    );

    if (error) throw error;

    if (!data?.enhancedImage) {
      console.warn('Enhance function returned no image, using original');
      return imageBlob;
    }

    const response = await withTimeout(
      fetch(`data:image/jpeg;base64,${data.enhancedImage}`),
      5000,
      'Enhanced image conversion'
    );
    return await response.blob();
  } catch (error) {
    console.warn('Enhancement skipped due to error:', error);
    return imageBlob;
  }
};

const uploadReceiptFiles = async (originalFile: File, enhancedFile: File) => {
  const timestamp = Date.now();
  
  // Upload original and enhanced in parallel; auto-overwrite on name collision
  const originalPath = `receipts/originals/${timestamp}-${originalFile.name}`;
  const enhancedPath = `receipts/enhanced/${timestamp}-${enhancedFile.name}`;

  const originalUpload = supabase.storage
    .from('receipts')
    .upload(originalPath, originalFile, { upsert: true, cacheControl: '3600' });

  const enhancedUpload = supabase.storage
    .from('receipts')
    .upload(enhancedPath, enhancedFile, { upsert: true, cacheControl: '3600' });

  const [{ error: originalError }, { error: enhancedError }] = await withTimeout(
    Promise.all([originalUpload, enhancedUpload]),
    20000,
    'Receipt upload'
  );

  if (originalError) throw originalError;
  if (enhancedError) throw enhancedError;
  
  console.info('[Upload] Stored files in bucket "receipts"', { originalPath, enhancedPath });
  return { originalPath, enhancedPath } as const;
};

  const resetForm = () => {
    setCapturedImage(null);
    setSelectedVendor('');
    setVendorName('');
    setPaymentMethod('');
    setReceiptAmount('');
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setNotes('');
  };

  return (
    <div className="h-full overflow-y-auto space-y-4 pb-20">
      {/* Job and Cost Code Pre-selection */}
      <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">Receipt Assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
              <Label htmlFor="job">Job (Required)</Label>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job (required)" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {jobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="costCode">Cost Code (Optional - for automatic coding)</Label>
              <Select value={selectedCostCode} onValueChange={setSelectedCostCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cost code" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {costCodes.map(code => (
                    <SelectItem key={code.id} value={code.id}>
                      {code.code} - {code.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
        </CardContent>
      </Card>

      {/* Camera/Upload Section */}
      <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">Receipt Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Button 
              onClick={startCamera} 
              className="w-full h-14 text-base"
              size="lg"
            >
              <Camera className="h-6 w-6 mr-3" />
              Take Photo
            </Button>
            
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              variant="outline" 
              className="w-full h-14 text-base"
              size="lg"
            >
              <Upload className="h-6 w-6 mr-3" />
              Upload from Gallery
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Receipt Details Form */}
      <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">Receipt Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="vendor">Vendor</Label>
            <Select value={selectedVendor} onValueChange={setSelectedVendor}>
              <SelectTrigger>
                <SelectValue placeholder="Select vendor (optional)" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {vendors.map(vendor => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="vendorName">Vendor/Supplier Name</Label>
            <Input
              id="vendorName"
              placeholder="Enter vendor/supplier name"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="company_card">Company Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={receiptAmount}
              onChange={(e) => setReceiptAmount(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Image Preview at Bottom */}
      {capturedImage && (
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Receipt Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <img 
                src={capturedImage} 
                alt="Captured receipt" 
                className="w-full rounded-lg border"
              />
            </div>
            
            <Button 
              onClick={resetForm} 
              variant="outline"
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Remove Image
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      <div className="pb-4">
        <Button 
          onClick={submitReceipt} 
          className="w-full h-14 text-base"
          size="lg"
          disabled={!capturedImage || isUploading || !selectedJob}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Submit Receipt
            </>
          )}
        </Button>
      </div>

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={() => stopCamera()}>
        <DialogContent className="max-w-full max-h-full p-0 m-0 h-screen w-screen bg-black">
          <DialogHeader className="absolute top-4 left-4 right-4 z-10">
            <DialogTitle className="text-white">Capture Receipt</DialogTitle>
          </DialogHeader>
          <div className="relative h-full w-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <Button 
                onClick={capturePhoto} 
                className="h-16 w-16 rounded-full bg-white text-black hover:bg-gray-200"
                size="lg"
              >
                <Camera className="h-8 w-8" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
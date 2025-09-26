import { useState, useRef, useCallback, useEffect } from 'react';
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

export function PMReceiptScanner() {
  const { user } = useAuth();
  const { addReceipts, codeReceipt } = useReceipts();
  const { toast } = useToast();
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCodingForm, setShowCodingForm] = useState(false);
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
      // Load jobs
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, name, address')
        .eq('status', 'active')
        .order('name');
      
      if (jobsData) setJobs(jobsData);

      // Load cost codes
      const { data: costCodesData } = await supabase
        .from('cost_codes')
        .select('id, code, description')
        .eq('is_active', true)
        .order('code');
      
      if (costCodesData) setCostCodes(costCodesData);

      // Load vendors
      const { data: vendorsData } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (vendorsData) setVendors(vendorsData);
      
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    setShowCodingForm(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
      setShowCodingForm(true);
    };
    reader.readAsDataURL(file);
  };

  const submitCodedReceipt = async () => {
    if (!capturedImage || !receiptAmount) {
      toast({
        title: 'Missing Information',
        description: 'Please capture receipt and enter amount.',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedJob || !selectedCostCode) {
      toast({
        title: 'Missing Assignment',
        description: 'Please select a job and cost code.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const fileName = `receipt-${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      const fileList = Object.create(FileList.prototype);
      Object.defineProperty(fileList, '0', { value: file });
      Object.defineProperty(fileList, 'length', { value: 1 });
      
      await addReceipts(fileList as FileList);
      
      setTimeout(() => {
        const receiptId = `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const selectedJobData = jobs.find(j => j.id === selectedJob);
        const selectedCostCodeData = costCodes.find(c => c.id === selectedCostCode);
        
        if (selectedJobData && selectedCostCodeData) {
          const jobName = selectedJobData.name;
          const costCodeName = `${selectedCostCodeData.code} - ${selectedCostCodeData.description}`;
          const codedBy = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || 'Project Manager';
          
          codeReceipt(receiptId, jobName, costCodeName, codedBy, selectedVendor);
        }
      }, 500);

      toast({
        title: 'Receipt Coded Successfully',
        description: 'Receipt has been processed and added to coded receipts.',
      });

      resetForm();
      
    } catch (error) {
      console.error('Error saving receipt:', error);
      toast({
        title: 'Save Error',
        description: 'Failed to save coded receipt. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setCapturedImage(null);
    setShowCodingForm(false);
    setSelectedVendor('');
    setVendorName('');
    setPaymentMethod('');
    setReceiptAmount('');
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setNotes('');
  };

  return (
    <div className="space-y-4">
      {/* Job and Cost Code Pre-selection */}
      <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">Receipt Assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="job">Job *</Label>
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger>
                <SelectValue placeholder="Select job" />
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
            <Label htmlFor="costCode">Cost Code *</Label>
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

      {!capturedImage && (
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
      )}

      {capturedImage && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="relative">
                <img 
                  src={capturedImage} 
                  alt="Captured receipt" 
                  className="w-full rounded-lg border"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={resetForm} 
                  variant="outline"
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Retake
                </Button>
                {!showCodingForm && (
                  <Button 
                    onClick={() => setShowCodingForm(true)}
                    className="flex-1"
                  >
                    Review Details
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Receipt Details Dialog */}
      <Dialog open={showCodingForm} onOpenChange={() => setShowCodingForm(false)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receipt Details</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Show selected job and cost code */}
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm font-medium mb-2">Assignment:</div>
              <div className="space-y-1 text-xs">
                <div>Job: <Badge variant="secondary">{jobs.find(j => j.id === selectedJob)?.name}</Badge></div>
                <div>Cost Code: <Badge variant="secondary">{costCodes.find(c => c.id === selectedCostCode)?.code} - {costCodes.find(c => c.id === selectedCostCode)?.description}</Badge></div>
              </div>
            </div>

            <div className="space-y-3">
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
                <Label htmlFor="amount">Amount *</Label>
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
            </div>

            <Button 
              onClick={submitCodedReceipt} 
              className="w-full"
              disabled={isUploading || !receiptAmount}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
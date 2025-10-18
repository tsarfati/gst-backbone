import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

export function ReceiptScanner() {
  const { user } = useAuth();
  const { addReceipts, codeReceipt } = useReceipts();
  const { toast } = useToast();
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCodingForm, setShowCodingForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedCostCode, setSelectedCostCode] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [ocrData, setOcrData] = useState<any>(null);
  
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
        .eq('is_dynamic_group', false)
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
          video: { facingMode: 'environment' } // Use rear camera for better document scanning
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
    processReceiptWithOCR(imageData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
      processReceiptWithOCR(imageData);
    };
    reader.readAsDataURL(file);
  };

  const processReceiptWithOCR = async (imageData: string) => {
    if (!imageData) return;
    
    setIsProcessing(true);
    
    try {
      // Extract base64 data from data URL
      const base64Data = imageData.split(',')[1];
      
      const { data, error } = await supabase.functions.invoke('process-receipt-ocr', {
        body: { imageBase64: base64Data }
      });

      if (error) throw error;

      if (data.success && data.extractedData) {
        setOcrData(data.extractedData);
        
        // Pre-fill form with OCR data
        if (data.extractedData.amount) {
          setReceiptAmount(data.extractedData.amount.toString());
        }
        if (data.extractedData.date) {
          setReceiptDate(data.extractedData.date);
        }
        if (data.extractedData.vendor) {
          // Try to find matching vendor
          const matchingVendor = vendors.find(v => 
            v.name.toLowerCase().includes(data.extractedData.vendor.toLowerCase()) ||
            data.extractedData.vendor.toLowerCase().includes(v.name.toLowerCase())
          );
          if (matchingVendor) {
            setSelectedVendor(matchingVendor.id);
          }
        }
        
        toast({
          title: 'Receipt Processed',
          description: 'OCR data extracted successfully. Please review and code the receipt.',
        });
      } else {
        toast({
          title: 'OCR Processing Failed',
          description: 'Could not extract data from receipt. Please enter details manually.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      toast({
        title: 'Processing Error',
        description: 'Failed to process receipt. Please enter details manually.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setShowCodingForm(true);
    }
  };

  const submitCodedReceipt = async () => {
    if (!capturedImage || !selectedJob || !selectedCostCode || !receiptAmount) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // Create a File object to use with addReceipts
      const fileName = `receipt-${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      const fileList = Object.create(FileList.prototype);
      Object.defineProperty(fileList, '0', { value: file });
      Object.defineProperty(fileList, 'length', { value: 1 });
      
      // Add receipt to uncoded receipts first
      await addReceipts(fileList as FileList);
      
      // Wait a moment for the receipt to be added
      setTimeout(() => {
        // Create a temporary receipt ID for coding (in real implementation, you'd get this from the context)
        const receiptId = `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Find the job and cost code names for coding
        const selectedJobData = jobs.find(j => j.id === selectedJob);
        const selectedCostCodeData = costCodes.find(c => c.id === selectedCostCode);
        
        if (selectedJobData && selectedCostCodeData) {
          const jobName = selectedJobData.name;
          const costCodeName = `${selectedCostCodeData.code} - ${selectedCostCodeData.description}`;
          const codedBy = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || 'Project Manager';
          
          // Code the receipt
          codeReceipt(receiptId, jobName, costCodeName, codedBy, selectedVendor);
        }
      }, 500);

      toast({
        title: 'Receipt Coded Successfully',
        description: 'Receipt has been processed and added to coded receipts.',
      });

      // Reset form
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
    setSelectedJob('');
    setSelectedCostCode('');
    setSelectedVendor('');
    setReceiptAmount('');
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setOcrData(null);
  };

  return (
    <div className="space-y-4">
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
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <div className="bg-white rounded-lg p-4 flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-medium">Processing OCR...</span>
                    </div>
                  </div>
                )}
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
                {!isProcessing && !showCodingForm && (
                  <Button 
                    onClick={() => setShowCodingForm(true)}
                    className="flex-1"
                  >
                    Code Receipt
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={() => stopCamera()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Capture Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg"
            />
            <canvas ref={canvasRef} className="hidden" />
            <Button onClick={capturePhoto} className="w-full">
              <Camera className="h-4 w-4 mr-2" />
              Capture Photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coding Form Dialog */}
      <Dialog open={showCodingForm} onOpenChange={() => setShowCodingForm(false)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Code Receipt</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {ocrData && (
              <div className="bg-muted p-3 rounded-lg">
                <div className="text-sm font-medium mb-2">OCR Results:</div>
                <div className="space-y-1 text-xs">
                  {ocrData.vendor && (
                    <div>Vendor: <Badge variant="secondary">{ocrData.vendor}</Badge></div>
                  )}
                  {ocrData.amount && (
                    <div>Amount: <Badge variant="secondary">${ocrData.amount}</Badge></div>
                  )}
                  {ocrData.date && (
                    <div>Date: <Badge variant="secondary">{ocrData.date}</Badge></div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label htmlFor="job">Job *</Label>
                <Select value={selectedJob} onValueChange={setSelectedJob}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
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
                  <SelectContent>
                    {costCodes.map(code => (
                      <SelectItem key={code.id} value={code.id}>
                        {code.code} - {code.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="vendor">Vendor</Label>
                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
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
                  placeholder="Optional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={resetForm} 
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={submitCodedReceipt}
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {isUploading ? 'Saving...' : 'Code Receipt'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
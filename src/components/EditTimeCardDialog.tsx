import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Clock, Save, X, AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface TimeCardData {
  id: string;
  user_id: string;
  job_id: string;
  cost_code_id: string;
  punch_in_time: string;
  punch_out_time: string;
  total_hours: number;
  overtime_hours: number;
  break_minutes: number;
  notes?: string;
  status: string;
  correction_reason?: string;
  company_id: string;
  profiles?: { display_name: string };
  jobs?: { name: string };
  cost_codes?: { code: string; description: string; type?: string };
}

interface EditTimeCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeCardId: string;
  onSave: () => void;
}

export default function EditTimeCardDialog({ open, onOpenChange, timeCardId, onSave }: EditTimeCardDialogProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [timeCard, setTimeCard] = useState<TimeCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Form fields
  const [punchInTime, setPunchInTime] = useState('');
  const [punchOutTime, setPunchOutTime] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  const [selectedCostCodeId, setSelectedCostCodeId] = useState<string>('');
  const [jobCostCodes, setJobCostCodes] = useState<Array<{ id: string; code: string; description: string }>>([]);

  const canEdit = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager' || timeCard?.user_id === user?.id;
  const isAdminOrController = profile?.role === 'admin' || profile?.role === 'controller';

  useEffect(() => {
    if (open && timeCardId) {
      loadTimeCard();
    }
  }, [open, timeCardId]);

  useEffect(() => {
    if (timeCard?.job_id) {
      supabase
        .from('cost_codes')
        .select('id, code, description')
        .eq('job_id', timeCard.job_id)
        .eq('is_active', true)
        .then(({ data }) => setJobCostCodes(data || []));
    }
    setSelectedCostCodeId(timeCard?.cost_code_id || '');
  }, [timeCard?.job_id, timeCard?.cost_code_id]);

  const loadTimeCard = async () => {
    if (!timeCardId) return;

    try {
      setLoading(true);
      
      const { data: timeCardData, error } = await supabase
        .from('time_cards')
        .select('*')
        .eq('id', timeCardId)
        .maybeSingle();

      if (error) throw error;
      if (!timeCardData) {
        toast({
          title: 'Time Card Not Found',
          description: 'The requested time card could not be found.',
          variant: 'destructive',
        });
        return;
      }

      // Fetch related data separately
      const [profileData, jobData, costCodeData] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', timeCardData.user_id)
          .maybeSingle(),
        timeCardData.job_id ? supabase
          .from('jobs')
          .select('name')
          .eq('id', timeCardData.job_id)
          .maybeSingle() : Promise.resolve({ data: null }),
        timeCardData.cost_code_id ? supabase
          .from('cost_codes')
          .select('code, description, type')
          .eq('id', timeCardData.cost_code_id)
          .maybeSingle() : Promise.resolve({ data: null })
      ]);

      const data = {
        ...timeCardData,
        profiles: profileData.data,
        jobs: jobData.data,
        cost_codes: costCodeData.data
      };

      setTimeCard(data as any);
      
      // Initialize form fields
      setPunchInTime(format(new Date(data.punch_in_time), "yyyy-MM-dd'T'HH:mm"));
      setPunchOutTime(format(new Date(data.punch_out_time), "yyyy-MM-dd'T'HH:mm"));
      setBreakMinutes(data.break_minutes?.toString() || '0');
      setNotes(data.notes || '');
      setCorrectionReason(data.correction_reason || '');
    } catch (error) {
      console.error('Error loading time card:', error);
      toast({
        title: 'Error',
        description: 'Failed to load time card details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateHours = (startTime: string, endTime: string, breakMins: number = 0) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const totalMs = end.getTime() - start.getTime();
    const totalHours = totalMs / (1000 * 60 * 60);
    const workingHours = Math.max(0, totalHours - (breakMins / 60));
    const overtimeHours = Math.max(0, workingHours - 8);
    
    return {
      totalHours: Math.round(workingHours * 100) / 100,
      overtimeHours: Math.round(overtimeHours * 100) / 100
    };
  };

  const handleSave = async () => {
    if (!timeCard || !canEdit) return;

    // Only require correction reason for non-admin/controller users
    if (!isAdminOrController && !correctionReason.trim()) {
      toast({
        title: 'Correction Reason Required',
        description: 'Please provide a reason for this correction.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const punchInDate = new Date(punchInTime);
      const punchOutDate = new Date(punchOutTime);
      const breakMins = parseInt(breakMinutes) || 0;

      if (punchOutDate <= punchInDate) {
        toast({
          title: 'Invalid Times',
          description: 'Punch out time must be after punch in time.',
          variant: 'destructive',
        });
        return;
      }

      const { totalHours, overtimeHours } = calculateHours(punchInTime, punchOutTime, breakMins);

      // Load punch clock settings to check if time card should be flagged
      const { data: flagSettings } = await supabase
        .from('job_punch_clock_settings')
        .select('flag_timecards_over_12hrs, flag_timecards_over_24hrs')
        .eq('company_id', timeCard.company_id)
        .is('job_id', null)
        .maybeSingle();

      const flagOver12 = flagSettings?.flag_timecards_over_12hrs ?? true;
      const flagOver24 = flagSettings?.flag_timecards_over_24hrs ?? true;

      // Check if time card should be flagged for approval
      const shouldFlag = (flagOver24 && totalHours > 24) || (flagOver12 && totalHours > 12);
      
      // If flagged, force pending status regardless of user role
      const newStatus = shouldFlag ? 'pending' : (isAdminOrController ? 'approved' : 'submitted');
      
      const { error } = await supabase
        .from('time_cards')
        .update({
          punch_in_time: punchInDate.toISOString(),
          punch_out_time: punchOutDate.toISOString(),
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          break_minutes: breakMins,
          notes: notes.trim() || null,
          correction_reason: correctionReason.trim() || null,
          cost_code_id: selectedCostCodeId || null,
          status: newStatus,
          approved_by: isAdminOrController && !shouldFlag ? user?.id : null,
          approved_at: isAdminOrController && !shouldFlag ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
          requires_approval: shouldFlag
        })
        .eq('id', timeCardId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: shouldFlag 
          ? 'Time card updated and flagged for approval (over 12 hours)'
          : 'Time card updated successfully.',
      });

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating time card:', error);
      toast({
        title: 'Error',
        description: 'Failed to update time card.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!timeCardId) return;

    try {
      setDeleting(true);
      
      const { error } = await supabase
        .from('time_cards')
        .update({ status: 'deleted' })
        .eq('id', timeCardId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Time card deleted successfully.',
      });

      setShowDeleteDialog(false);
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting time card:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete time card.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <div>Loading time card...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!timeCard) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <div>Time card not found.</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!canEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-muted-foreground">
                You don't have permission to edit this time card.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { totalHours, overtimeHours } = calculateHours(punchInTime, punchOutTime, parseInt(breakMinutes) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Edit Time Card
          </DialogTitle>
          <DialogDescription>
            {timeCard.profiles?.display_name} - {format(new Date(timeCard.punch_in_time), 'PPPP')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Information (Read-only) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Job</Label>
                <div className="font-medium">{timeCard.jobs?.name}</div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Cost Code</Label>
                {canEdit ? (
                  <Select value={selectedCostCodeId || ''} onValueChange={setSelectedCostCodeId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select cost code" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobCostCodes.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.code} - {cc.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="font-medium">
                    {timeCard.cost_codes?.code} - {timeCard.cost_codes?.description}
                    {timeCard.cost_codes?.type && ` (${timeCard.cost_codes.type})`}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Time Details (Editable) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Time Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="punch-in-time">Punch In Time *</Label>
                  <Input
                    id="punch-in-time"
                    type="datetime-local"
                    value={punchInTime}
                    onChange={(e) => setPunchInTime(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="punch-out-time">Punch Out Time *</Label>
                  <Input
                    id="punch-out-time"
                    type="datetime-local"
                    value={punchOutTime}
                    onChange={(e) => setPunchOutTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="break-minutes">Break Minutes</Label>
                <Input
                  id="break-minutes"
                  type="number"
                  min="0"
                  max="480"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                  placeholder="0"
                />
              </div>

              <Separator />

              {/* Calculated Hours (Read-only) */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-sm text-muted-foreground">Total Hours</Label>
                  <div className="font-bold text-lg">{totalHours.toFixed(2)}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Overtime Hours</Label>
                  <div className="font-bold text-lg text-orange-600">{overtimeHours.toFixed(2)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          {/* Correction Reason (Optional for admins/controllers) */}
          <div>
            <Label htmlFor="correction-reason">
              Correction Reason {!isAdminOrController && '*'}
            </Label>
            <Textarea
              id="correction-reason"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder={isAdminOrController 
                ? "Optional: Explain why this time card is being corrected..." 
                : "Please explain why this time card is being corrected..."}
              rows={3}
              required={!isAdminOrController}
            />
            {isAdminOrController && (
              <p className="text-xs text-muted-foreground mt-1">
                Your changes will be automatically approved
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button 
            variant="destructive" 
            onClick={() => setShowDeleteDialog(true)} 
            disabled={saving || deleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Time Card
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || deleting}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time card? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
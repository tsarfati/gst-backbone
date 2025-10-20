import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Clock, Save, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface JobShiftTimeSettingsProps {
  jobId: string;
}

export const JobShiftTimeSettings = ({ jobId }: JobShiftTimeSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState("");
  const [shiftEndTime, setShiftEndTime] = useState("");
  const [countEarlyPunchIn, setCountEarlyPunchIn] = useState(false);
  const [earlyPunchInGraceMinutes, setEarlyPunchInGraceMinutes] = useState(15);
  const [countLatePunchOut, setCountLatePunchOut] = useState(true);
  const [latePunchOutGraceMinutes, setLatePunchOutGraceMinutes] = useState(15);

  useEffect(() => {
    loadSettings();
  }, [jobId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "shift_start_time, shift_end_time, count_early_punch_in, early_punch_in_grace_minutes, count_late_punch_out, late_punch_out_grace_minutes"
        )
        .eq("id", jobId)
        .single();

      if (error) throw error;

      if (data) {
        setShiftStartTime(data.shift_start_time || "");
        setShiftEndTime(data.shift_end_time || "");
        setCountEarlyPunchIn(data.count_early_punch_in || false);
        setEarlyPunchInGraceMinutes(data.early_punch_in_grace_minutes || 15);
        setCountLatePunchOut(data.count_late_punch_out ?? true);
        setLatePunchOutGraceMinutes(data.late_punch_out_grace_minutes || 15);
      }
    } catch (error: any) {
      console.error("Error loading shift settings:", error);
      toast({
        title: "Error",
        description: "Failed to load shift time settings.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          shift_start_time: shiftStartTime || null,
          shift_end_time: shiftEndTime || null,
          count_early_punch_in: countEarlyPunchIn,
          early_punch_in_grace_minutes: earlyPunchInGraceMinutes,
          count_late_punch_out: countLatePunchOut,
          late_punch_out_grace_minutes: latePunchOutGraceMinutes,
        })
        .eq("id", jobId);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Shift time rules have been updated successfully.",
      });
    } catch (error: any) {
      console.error("Error saving shift settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save shift time settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isShiftConfigured = shiftStartTime && shiftEndTime;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Shift Time Rules
        </CardTitle>
        <CardDescription>
          Configure standard shift times and how early/late punches are handled
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isShiftConfigured && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Set shift start and end times to enable time adjustment rules. Without shift times,
              all punch times will be counted as-is.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="shift-start">Shift Start Time</Label>
            <Input
              id="shift-start"
              type="time"
              value={shiftStartTime}
              onChange={(e) => setShiftStartTime(e.target.value)}
              placeholder="08:00"
            />
            <p className="text-xs text-muted-foreground">
              Standard start time for this job's shift
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shift-end">Shift End Time</Label>
            <Input
              id="shift-end"
              type="time"
              value={shiftEndTime}
              onChange={(e) => setShiftEndTime(e.target.value)}
              placeholder="17:00"
            />
            <p className="text-xs text-muted-foreground">
              Standard end time for this job's shift (supports overnight shifts)
            </p>
          </div>
        </div>

        {isShiftConfigured && (
          <>
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="count-early">Count Early Punch-In Time</Label>
                    <p className="text-sm text-muted-foreground">
                      If enabled, time before shift start (within grace period) counts as work time
                    </p>
                  </div>
                  <Switch
                    id="count-early"
                    checked={countEarlyPunchIn}
                    onCheckedChange={setCountEarlyPunchIn}
                  />
                </div>

                <div className="space-y-2 ml-6">
                  <Label htmlFor="early-grace">Early Punch-In Grace Period (minutes)</Label>
                  <Input
                    id="early-grace"
                    type="number"
                    min="0"
                    max="120"
                    value={earlyPunchInGraceMinutes}
                    onChange={(e) => setEarlyPunchInGraceMinutes(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Employees can punch in up to this many minutes early.{" "}
                    {countEarlyPunchIn
                      ? "Early time will be counted."
                      : "Time starts at shift start."}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="count-late">Count Late Punch-Out Time</Label>
                    <p className="text-sm text-muted-foreground">
                      When enabled, time after shift end is counted as work time only if beyond grace period (all late time including grace period is then counted)
                    </p>
                  </div>
                  <Switch
                    id="count-late"
                    checked={countLatePunchOut}
                    onCheckedChange={setCountLatePunchOut}
                  />
                </div>

                <div className="space-y-2 ml-6">
                  <Label htmlFor="late-grace">Late Punch-Out Grace Period (minutes)</Label>
                  <Input
                    id="late-grace"
                    type="number"
                    min="0"
                    max="120"
                    value={latePunchOutGraceMinutes}
                    onChange={(e) => setLatePunchOutGraceMinutes(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Within grace period: no late time counted. Beyond grace period: all late time (including grace period) is counted if enabled.
                  </p>
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>How it works:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>
                    Punches outside grace periods are capped at shift start/end + grace minutes
                  </li>
                  <li>Overnight shifts are automatically detected when end time &lt; start time</li>
                  <li>These rules only apply when both shift times are set</li>
                </ul>
              </AlertDescription>
            </Alert>
          </>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Shift Time Rules
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

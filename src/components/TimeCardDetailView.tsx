import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, MapPin, Camera, User, AlertTriangle, CheckCircle, X, Calendar, FileText, Edit, History, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { geocodeAddress } from '@/utils/geocoding';
import { calculateDistance, formatDistance } from '@/utils/distanceCalculation';
import { useToast } from '@/hooks/use-toast';
import AuditTrailView from './AuditTrailView';
import EditTimeCardDialog from './EditTimeCardDialog';

interface TimeCardDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeCardId: string;
}

interface TimeCardDetail {
  id: string;
  user_id: string;
  job_id: string;
  cost_code_id: string;
  punch_in_time: string;
  punch_out_time: string;
  total_hours: number;
  overtime_hours: number;
  status: string;
  break_minutes: number;
  break_duration_minutes?: number;
  notes?: string;
  review_notes?: string;
  distance_warning: boolean;
  distance_from_job_meters?: number;
  requires_approval: boolean;
  created_via_punch_clock: boolean;
  punch_in_location_lat?: number;
  punch_in_location_lng?: number;
  punch_out_location_lat?: number;
  punch_out_location_lng?: number;
  punch_in_photo_url?: string;
  punch_out_photo_url?: string;
  correction_reason?: string;
  profiles?: { first_name: string; last_name: string; display_name: string; email?: string; phone?: string; role?: string; avatar_url?: string };
  jobs?: { name: string; latitude?: number; longitude?: number };
  cost_codes?: { code: string; description: string; type?: string };
}

export default function TimeCardDetailView({ open, onOpenChange, timeCardId }: TimeCardDetailViewProps) {
  const { user, profile } = useAuth();
  const { currentCompany, userCompanies } = useCompany();
  const { toast } = useToast();
  const [timeCard, setTimeCard] = useState<TimeCardDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'audit' | 'map'>('details');
  const [distanceWarningSettings, setDistanceWarningSettings] = useState<{
    enabled: boolean;
    maxDistance: number;
  } | null>(null);
  const [punchInDistance, setPunchInDistance] = useState<number | null>(null);
  const [punchOutDistance, setPunchOutDistance] = useState<number | null>(null);
  const [pendingChangeRequest, setPendingChangeRequest] = useState<any>(null);
  const [approving, setApproving] = useState(false);
  const [denying, setDenying] = useState(false);
  const [jobs, setJobs] = useState<Record<string, any>>({});
  const [costCodes, setCostCodes] = useState<Record<string, any>>({});
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Get user's role for the current company
  const currentUserRole = userCompanies.find(uc => uc.company_id === currentCompany?.id)?.role;
  const isManager = currentUserRole === 'admin' || currentUserRole === 'controller' || currentUserRole === 'project_manager';
  const canEdit = currentUserRole === 'admin' || currentUserRole === 'controller';
  
  console.log('TimeCardDetailView - Current user role:', currentUserRole);
  console.log('TimeCardDetailView - isManager:', isManager);
  console.log('TimeCardDetailView - Company ID:', currentCompany?.id);
  console.log('TimeCardDetailView - User companies:', userCompanies);
  
  // Extract nested data for easier use
  const job = timeCard?.jobs;
  const costCode = timeCard?.cost_codes;
  const employeeProfile = timeCard?.profiles;

  useEffect(() => {
    if (open && timeCardId) {
      loadTimeCardDetails();
    }
  }, [open, timeCardId]);

  useEffect(() => {
    if (open && activeTab === 'map' && timeCard && !map.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (mapContainer.current) {
          initializeMap();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [open, timeCard, activeTab]);

  const loadTimeCardDetails = async () => {
    if (!timeCardId) return;

    try {
      setLoading(true);
      
      const { data: timeCardData, error } = await supabase
        .from('time_cards')
        .select('*')
        .eq('id', timeCardId)
        .single();

      if (error) throw error;

      // Fetch related data separately - check both profiles and pin_employees
      const [profileData, pinEmployeeData, jobData, costCodeData, punchData, roleData] = await Promise.all([
        supabase
          .from('profiles')
          .select('first_name, last_name, display_name')
          .eq('user_id', timeCardData.user_id)
          .single(),
        supabase
          .from('pin_employees')
          .select('first_name, last_name, display_name')
          .eq('id', timeCardData.user_id)
          .single(),
        timeCardData.job_id ? supabase
          .from('jobs')
          .select('name, latitude, longitude, address')
          .eq('id', timeCardData.job_id)
          .single() : Promise.resolve({ data: null }),
        timeCardData.cost_code_id ? supabase
          .from('cost_codes')
          .select('code, description, type')
          .eq('id', timeCardData.cost_code_id)
          .single() : Promise.resolve({ data: null }),
        // Fetch punch records with buffer time to capture actual punch records (include cost_code_id)
        (() => {
          const punchInBuffer = new Date(new Date(timeCardData.punch_in_time).getTime() - 30000).toISOString();
          const punchOutBuffer = timeCardData.punch_out_time 
            ? new Date(new Date(timeCardData.punch_out_time).getTime() + 30000).toISOString()
            : new Date().toISOString();
          
          return supabase
            .from('punch_records')
            .select('punch_type, latitude, longitude, photo_url, punch_time, cost_code_id')
            .eq('user_id', timeCardData.user_id)
            .gte('punch_time', punchInBuffer)
            .lte('punch_time', punchOutBuffer)
            .order('punch_time', { ascending: true });
        })(),
        // Fetch the user's role for this company
        supabase
          .from('user_company_access')
          .select('role')
          .eq('user_id', timeCardData.user_id)
          .eq('company_id', timeCardData.company_id)
          .single()
      ]);

      console.log('Time card data:', timeCardData);
      console.log('Punch records found:', punchData.data);

      // Backfill missing location, photo and cost code data from punch records
      const punchRecords = punchData.data || [];
      const punchIn = punchRecords.find(p => p.punch_type === 'punched_in');
      const punchOut = punchRecords.find(p => p.punch_type === 'punched_out');

      console.log('Punch in record:', punchIn);
      console.log('Punch out record:', punchOut);

      // If cost code missing on time card, try to backfill from punch_out record first
      let resolvedCostCode = costCodeData.data as any;
      let resolvedCostCodeId: string | null = (timeCardData.cost_code_id as string | null) ?? null;
      if (!resolvedCostCode && (!resolvedCostCodeId || resolvedCostCodeId === null)) {
        const fallbackCodeId = punchOut?.cost_code_id || punchIn?.cost_code_id || null;
        if (fallbackCodeId) {
          const { data: fallbackCode } = await supabase
            .from('cost_codes')
            .select('code, description, type')
            .eq('id', fallbackCodeId)
            .maybeSingle();
          if (fallbackCode) {
            resolvedCostCode = fallbackCode;
            resolvedCostCodeId = fallbackCodeId as string;
            
            // Update the time card with the backfilled cost code
            await supabase
              .from('time_cards')
              .update({ cost_code_id: fallbackCodeId })
              .eq('id', timeCardId);
          }
        }
      }

      const normalizePhotoUrl = (url?: string | null) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        // Treat as a path inside the 'punch-photos' bucket
        const { data: publicData } = supabase.storage.from('punch-photos').getPublicUrl(url);
        return publicData?.publicUrl || null;
      };

      // Use profile data from either profiles or pin_employees
      const employeeProfile = profileData.data || pinEmployeeData.data;

      // Use company-specific role from the parallel fetch
      const employeeRole = roleData.data?.role || 'employee';

      const data = {
        ...timeCardData,
        profiles: { ...(employeeProfile || {}), role: employeeRole },
        jobs: jobData.data,
        cost_codes: resolvedCostCode,
        cost_code_id: resolvedCostCodeId,
        // Ensure coordinates are numbers and backfill from punch records
        punch_in_location_lat: Number(timeCardData.punch_in_location_lat) || Number(punchIn?.latitude) || null,
        punch_in_location_lng: Number(timeCardData.punch_in_location_lng) || Number(punchIn?.longitude) || null,
        punch_out_location_lat: Number(timeCardData.punch_out_location_lat) || Number(punchOut?.latitude) || null,
        punch_out_location_lng: Number(timeCardData.punch_out_location_lng) || Number(punchOut?.longitude) || null,
        punch_in_photo_url: normalizePhotoUrl(timeCardData.punch_in_photo_url || punchIn?.photo_url || null),
        punch_out_photo_url: normalizePhotoUrl(timeCardData.punch_out_photo_url || punchOut?.photo_url || null),
      };

      // Persist backfilled cost code if we resolved it and it was missing
      if (!timeCardData.cost_code_id && resolvedCostCodeId) {
        await supabase
          .from('time_cards')
          .update({ cost_code_id: resolvedCostCodeId })
          .eq('id', timeCardId);
      }

      console.log('Final time card data:', data);
      setTimeCard(data as any);
      
      // Check for latest change request (prefer pending)
      const { data: changeRequests } = await supabase
        .from('time_card_change_requests')
        .select('id, status, reason, created_at, requested_at, proposed_punch_in_time, proposed_punch_out_time, proposed_job_id, proposed_cost_code_id')
        .eq('time_card_id', timeCardId)
        .order('requested_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3);
      
      const pendingCR = (changeRequests || []).find((cr: any) => cr.status === 'pending') || null;
      const latestCR = pendingCR || (changeRequests && changeRequests[0]) || null;
      console.log('Pending (or latest) change request:', latestCR);
      setPendingChangeRequest(pendingCR); // only show UI when truly pending
      
      // Load job and cost code data for change request if it exists
      const crForLookup = pendingCR || latestCR;
      if (crForLookup) {
        const jobIdsToLoad = [
          timeCardData.job_id,
          crForLookup.proposed_job_id
        ].filter(Boolean);
        
        const costCodeIdsToLoad = [
          timeCardData.cost_code_id,
          crForLookup.proposed_cost_code_id
        ].filter(Boolean);
        
        if (jobIdsToLoad.length > 0) {
          const { data: jobsData } = await supabase
            .from('jobs')
            .select('id, name')
            .in('id', jobIdsToLoad);
          
          const jobsMap: Record<string, any> = {};
          (jobsData || []).forEach(j => { jobsMap[j.id] = j; });
          setJobs(prev => ({ ...prev, ...jobsMap }));
        }
        
        if (costCodeIdsToLoad.length > 0) {
          const { data: costCodesData } = await supabase
            .from('cost_codes')
            .select('id, code, description')
            .in('id', costCodeIdsToLoad);
          
          const costCodesMap: Record<string, any> = {};
          (costCodesData || []).forEach(cc => { costCodesMap[cc.id] = cc; });
          setCostCodes(prev => ({ ...prev, ...costCodesMap }));
        }
      }
      
      // Load distance warning settings if job exists
      if (timeCardData.job_id) {
        const { data: settings } = await supabase
          .from('job_punch_clock_settings')
          .select('enable_distance_warning, max_distance_from_job_meters')
          .eq('job_id', timeCardData.job_id)
          .single();
          
        if (settings) {
          setDistanceWarningSettings({
            enabled: settings.enable_distance_warning ?? true,
            maxDistance: settings.max_distance_from_job_meters ?? 500
          });
          
          // Calculate distances if we have coordinates
          if (jobData.data?.latitude && jobData.data?.longitude) {
            const jobLat = Number(jobData.data.latitude);
            const jobLng = Number(jobData.data.longitude);
            
            if (data.punch_in_location_lat && data.punch_in_location_lng) {
              const dist = calculateDistance(
                Number(data.punch_in_location_lat),
                Number(data.punch_in_location_lng),
                jobLat,
                jobLng
              );
              setPunchInDistance(dist);
            }
            
            if (data.punch_out_location_lat && data.punch_out_location_lng) {
              const dist = calculateDistance(
                Number(data.punch_out_location_lat),
                Number(data.punch_out_location_lng),
                jobLat,
                jobLng
              );
              setPunchOutDistance(dist);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading time card details:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = async () => {
    if (!mapContainer.current || !timeCard) return;

    try {
      console.log('Initializing map for timeCard:', timeCard);
      console.log('Location data:', {
        jobLat: timeCard.jobs?.latitude,
        jobLng: timeCard.jobs?.longitude,
        punchInLat: timeCard.punch_in_location_lat,
        punchInLng: timeCard.punch_in_location_lng,
        punchOutLat: timeCard.punch_out_location_lat,
        punchOutLng: timeCard.punch_out_location_lng
      });
      
      // Get Mapbox token from Supabase secrets
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      console.log('Mapbox token response:', data, error);
      
      if (data?.MAPBOX_PUBLIC_TOKEN) {
        mapboxgl.accessToken = data.MAPBOX_PUBLIC_TOKEN;
      } else {
        console.error('Mapbox token not found, using fallback token');
        mapboxgl.accessToken = 'pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg';
      }
    } catch (error) {
      console.error('Error getting Mapbox token:', error);
      // Use fallback token
      mapboxgl.accessToken = 'pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg';
    }

    // Center map on job location or punch locations, with fallback to Philadelphia
    let centerLat = timeCard.jobs?.latitude || timeCard.punch_in_location_lat || 39.9526;
    let centerLng = timeCard.jobs?.longitude || timeCard.punch_in_location_lng || -75.1652;

    // If job coords missing but address available, geocode as fallback
    try {
      const jobAddress = (timeCard as any)?.jobs?.address as string | undefined;
      if ((!timeCard.jobs?.latitude || !timeCard.jobs?.longitude) && jobAddress) {
        const geo = await geocodeAddress(jobAddress);
        if (geo) {
          centerLat = geo.latitude;
          centerLng = geo.longitude;
        }
      }
    } catch (e) {
      console.warn('Geocode fallback failed:', e);
    }
    
    console.log('Map center:', { centerLat, centerLng });

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [centerLng, centerLat],
      zoom: centerLat === 39.9526 && centerLng === -75.1652 ? 10 : 15
    });

    // Handle sizing and errors
    map.current.on('error', (e) => console.error('Mapbox error:', e));
    setTimeout(() => map.current?.resize(), 300);

    map.current.on('load', () => {
      if (!map.current || !timeCard) return;

      // Add job location marker if available
      if (timeCard.jobs?.latitude && timeCard.jobs?.longitude) {
        new mapboxgl.Marker({ color: '#3b82f6', scale: 1.2 })
          .setLngLat([timeCard.jobs.longitude, timeCard.jobs.latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>Job Site</strong><br/>${timeCard.jobs.name}`))
          .addTo(map.current);
      }

      // Add punch in location marker
      if (timeCard.punch_in_location_lat && timeCard.punch_in_location_lng) {
        new mapboxgl.Marker({ color: '#10b981' })
          .setLngLat([timeCard.punch_in_location_lng, timeCard.punch_in_location_lat])
          .setPopup(new mapboxgl.Popup().setHTML('<strong>Punch In Location</strong>'))
          .addTo(map.current);
      }

      // Add punch out location marker
      if (timeCard.punch_out_location_lat && timeCard.punch_out_location_lng) {
        new mapboxgl.Marker({ color: '#ef4444' })
          .setLngLat([timeCard.punch_out_location_lng, timeCard.punch_out_location_lat])
          .setPopup(new mapboxgl.Popup().setHTML('<strong>Punch Out Location</strong>'))
          .addTo(map.current);
      }

      // Add distance warning circle if job location exists
      if (timeCard.jobs?.latitude && timeCard.jobs?.longitude && timeCard.distance_warning) {
        map.current.addSource('job-radius', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [timeCard.jobs.longitude, timeCard.jobs.latitude]
            },
            properties: {}
          }
        });

        map.current.addLayer({
          id: 'job-radius-layer',
          type: 'circle',
          source: 'job-radius',
          paint: {
            'circle-radius': {
              stops: [[0, 0], [20, 100]]
            },
            'circle-color': '#ef4444',
            'circle-opacity': 0.2,
            'circle-stroke-color': '#ef4444',
            'circle-stroke-width': 2,
            'circle-stroke-opacity': 0.8
          }
        });
      }

      // Fit map to show all markers
      const bounds = new mapboxgl.LngLatBounds();
      if (timeCard.jobs?.latitude && timeCard.jobs?.longitude) {
        bounds.extend([timeCard.jobs.longitude, timeCard.jobs.latitude]);
      }
      if (timeCard.punch_in_location_lat && timeCard.punch_in_location_lng) {
        bounds.extend([timeCard.punch_in_location_lng, timeCard.punch_in_location_lat]);
      }
      if (timeCard.punch_out_location_lat && timeCard.punch_out_location_lng) {
        bounds.extend([timeCard.punch_out_location_lng, timeCard.punch_out_location_lat]);
      }
      
      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, { padding: 50 });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'approved-edited': return 'default';
      case 'rejected': return 'destructive';
      case 'submitted': return 'secondary';
      default: return 'outline';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleApproveChangeRequest = async () => {
    if (!pendingChangeRequest || !isManager) return;

    try {
      setApproving(true);

      // Update the change request status to approved
      const { error: changeRequestError } = await supabase
        .from('time_card_change_requests')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', pendingChangeRequest.id);

      if (changeRequestError) throw changeRequestError;

      // Update the time card status to approved-edited
      const { error: timeCardError } = await supabase
        .from('time_cards')
        .update({
          status: 'approved-edited',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', timeCard.id);

      if (timeCardError) throw timeCardError;

      toast({
        title: "Change Request Approved",
        description: "The time card has been marked as approved-edited.",
      });

      // Reload the time card details
      onOpenChange(false);
    } catch (error) {
      console.error('Error approving change request:', error);
      toast({
        title: "Error",
        description: "Failed to approve change request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleRejectChangeRequest = async () => {
    if (!pendingChangeRequest || !isManager) return;
    try {
      setDenying(true);
      const { error: changeRequestError } = await supabase
        .from('time_card_change_requests')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', pendingChangeRequest.id);
      if (changeRequestError) throw changeRequestError;

      toast({ title: 'Change Request Denied', description: 'The change request was marked as rejected.' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error rejecting change request:', error);
      toast({ title: 'Error', description: 'Failed to deny change request. Please try again.', variant: 'destructive' });
    } finally {
      setDenying(false);
    }
  };

  const handleApproveTimeCard = async () => {
    if (!user?.id || !isManager) return;
    
    const comments = prompt('Optional approval comments:');
    
    try {
      setApproving(true);

      // Update the time card status to approved
      const { error: updateError } = await supabase
        .from('time_cards')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          review_notes: comments || null
        })
        .eq('id', timeCard!.id);

      if (updateError) throw updateError;

      // Log to audit trail with correct field names
      await supabase
        .from('time_card_audit_trail')
        .insert({
          time_card_id: timeCard!.id,
          changed_by: user.id,
          change_type: 'approved',
          reason: comments || 'Time card approved',
          created_at: new Date().toISOString()
        });

      toast({
        title: "Time Card Approved",
        description: "The time card has been approved successfully.",
      });

      // Reload the time card details
      onOpenChange(false);
    } catch (error) {
      console.error('Error approving time card:', error);
      toast({
        title: "Error",
        description: "Failed to approve time card. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleDenyTimeCard = async () => {
    if (!user?.id || !isManager) return;
    
    const comments = prompt('Reason for denial (required):');
    if (!comments) {
      toast({
        title: "Denial Cancelled",
        description: "A reason is required to deny a time card.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setDenying(true);

      // Update the time card status to rejected
      const { error: updateError } = await supabase
        .from('time_cards')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          review_notes: comments
        })
        .eq('id', timeCard!.id);

      if (updateError) throw updateError;

      // Log to audit trail with correct field names
      await supabase
        .from('time_card_audit_trail')
        .insert({
          time_card_id: timeCard!.id,
          changed_by: user.id,
          change_type: 'rejected',
          reason: comments,
          created_at: new Date().toISOString()
        });

      toast({
        title: "Time Card Denied",
        description: "The time card has been denied.",
      });

      // Reload the time card details
      onOpenChange(false);
    } catch (error) {
      console.error('Error denying time card:', error);
      toast({
        title: "Error",
        description: "Failed to deny time card. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDenying(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading time card details</DialogTitle>
            <DialogDescription>Fetching the latest data…</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">Loading time card details...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!timeCard) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Card Details
              </DialogTitle>
              <DialogDescription>
                {formatDate(timeCard.punch_in_time)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Time Card Approval Section - Top Priority */}
        {isManager && timeCard.status !== 'approved' && timeCard.status !== 'approved-edited' && timeCard.status !== 'rejected' && (
          <Card className="border-primary bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Shield className="h-5 w-5" />
                Time Card Approval Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button 
                  onClick={handleApproveTimeCard}
                  disabled={approving || denying}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <CheckCircle className="h-4 w-4" />
                  {approving ? 'Approving...' : 'Approve Time Card'}
                </Button>
                <Button 
                  onClick={handleDenyTimeCard}
                  disabled={approving || denying}
                  variant="destructive"
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <X className="h-4 w-4" />
                  {denying ? 'Denying...' : 'Deny Time Card'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Change Request Alert - Show prominently if there's a pending change request */}
        {pendingChangeRequest && (
          <Card className="border-warning bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertCircle className="h-5 w-5" />
                Pending Change Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Reason for change */}
              <div className="bg-background rounded-md p-3 border-l-4 border-warning">
                <p className="text-sm font-semibold text-muted-foreground mb-1">Reason:</p>
                <p className="text-sm">{pendingChangeRequest.reason || 'No reason provided'}</p>
              </div>
              
              {/* Compact change list */}
              <div className="bg-background rounded-md p-3 space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">Requested Changes:</p>
                
                {pendingChangeRequest.proposed_punch_in_time && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Punch In:</span>
                    <span className="line-through text-red-600">{format(new Date(timeCard.punch_in_time), 'h:mm a')}</span>
                    <span>→</span>
                    <span className="font-medium text-green-600">{format(new Date(pendingChangeRequest.proposed_punch_in_time), 'h:mm a')}</span>
                  </div>
                )}
                
                {pendingChangeRequest.proposed_punch_out_time && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Punch Out:</span>
                    <span className="line-through text-red-600">{format(new Date(timeCard.punch_out_time), 'h:mm a')}</span>
                    <span>→</span>
                    <span className="font-medium text-green-600">{format(new Date(pendingChangeRequest.proposed_punch_out_time), 'h:mm a')}</span>
                  </div>
                )}
                
                {pendingChangeRequest.proposed_job_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Job:</span>
                    <span className="line-through text-red-600">{jobs[timeCard.job_id]?.name || 'Unknown'}</span>
                    <span>→</span>
                    <span className="font-medium text-green-600">{jobs[pendingChangeRequest.proposed_job_id]?.name || 'Unknown'}</span>
                  </div>
                )}
                
                {pendingChangeRequest.proposed_cost_code_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Cost Code:</span>
                    <span className="line-through text-red-600">{timeCard.cost_code_id ? (costCodes[timeCard.cost_code_id]?.code || 'Unknown') : 'None'}</span>
                    <span>→</span>
                    <span className="font-medium text-green-600">{costCodes[pendingChangeRequest.proposed_cost_code_id]?.code || 'Unknown'}</span>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Requested: {format(new Date(pendingChangeRequest.created_at), 'MMM dd, yyyy h:mm a')}
                </div>
              </div>
              
              {/* Approval/Denial Buttons */}
              {isManager && (
                <div className="flex gap-2">
                  <Button 
                    onClick={async () => {
                      const comments = prompt('Optional approval comments:');
                      
                      // Build audit trail details
                      const changes: string[] = [];
                      if (pendingChangeRequest.proposed_punch_in_time) {
                        changes.push(`Punch In: ${format(new Date(timeCard.punch_in_time), 'h:mm a')} → ${format(new Date(pendingChangeRequest.proposed_punch_in_time), 'h:mm a')}`);
                      }
                      if (pendingChangeRequest.proposed_punch_out_time) {
                        changes.push(`Punch Out: ${format(new Date(timeCard.punch_out_time), 'h:mm a')} → ${format(new Date(pendingChangeRequest.proposed_punch_out_time), 'h:mm a')}`);
                      }
                      if (pendingChangeRequest.proposed_job_id) {
                        changes.push(`Job: ${jobs[timeCard.job_id]?.name || 'Unknown'} → ${jobs[pendingChangeRequest.proposed_job_id]?.name || 'Unknown'}`);
                      }
                      if (pendingChangeRequest.proposed_cost_code_id) {
                        const oldCode = timeCard.cost_code_id ? costCodes[timeCard.cost_code_id]?.code : 'None';
                        const newCode = costCodes[pendingChangeRequest.proposed_cost_code_id]?.code || 'Unknown';
                        changes.push(`Cost Code: ${oldCode} → ${newCode}`);
                      }
                      
                      const auditDetails = [`Change request approved`];
                      if (changes.length > 0) {
                        auditDetails.push('Changes: ' + changes.join('; '));
                      }
                      if (pendingChangeRequest.reason) {
                        auditDetails.push('Reason: ' + pendingChangeRequest.reason);
                      }
                      if (comments) {
                        auditDetails.push('Review notes: ' + comments);
                      }
                      
                      try {
                        setApproving(true);
                        const { error } = await supabase.functions.invoke('punch-clock', {
                          body: {
                            action: 'review-change-request',
                            request_id: pendingChangeRequest.id,
                            status: 'approved',
                            review_notes: auditDetails.join(' | ')
                          }
                        });
                        if (error) throw error;
                        toast({ title: 'Success', description: 'Change request approved' });
                        onOpenChange(false);
                      } catch (error: any) {
                        toast({ title: 'Error', description: error.message, variant: 'destructive' });
                      } finally {
                        setApproving(false);
                      }
                    }}
                    disabled={approving || denying}
                    className="flex-1 gap-2"
                    size="lg"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {approving ? 'Approving...' : 'Approve Change Request'}
                  </Button>
                  <Button 
                    onClick={async () => {
                      const comments = prompt('Reason for denial (optional):');
                      
                      // Build audit trail details
                      const changes: string[] = [];
                      if (pendingChangeRequest.proposed_punch_in_time) {
                        changes.push(`Punch In: ${format(new Date(timeCard.punch_in_time), 'h:mm a')} → ${format(new Date(pendingChangeRequest.proposed_punch_in_time), 'h:mm a')}`);
                      }
                      if (pendingChangeRequest.proposed_punch_out_time) {
                        changes.push(`Punch Out: ${format(new Date(timeCard.punch_out_time), 'h:mm a')} → ${format(new Date(pendingChangeRequest.proposed_punch_out_time), 'h:mm a')}`);
                      }
                      if (pendingChangeRequest.proposed_job_id) {
                        changes.push(`Job: ${jobs[timeCard.job_id]?.name || 'Unknown'} → ${jobs[pendingChangeRequest.proposed_job_id]?.name || 'Unknown'}`);
                      }
                      if (pendingChangeRequest.proposed_cost_code_id) {
                        const oldCode = timeCard.cost_code_id ? costCodes[timeCard.cost_code_id]?.code : 'None';
                        const newCode = costCodes[pendingChangeRequest.proposed_cost_code_id]?.code || 'Unknown';
                        changes.push(`Cost Code: ${oldCode} → ${newCode}`);
                      }
                      
                      const auditDetails = [`Change request rejected`];
                      if (changes.length > 0) {
                        auditDetails.push('Requested changes: ' + changes.join('; '));
                      }
                      if (pendingChangeRequest.reason) {
                        auditDetails.push('Employee reason: ' + pendingChangeRequest.reason);
                      }
                      if (comments) {
                        auditDetails.push('Rejection notes: ' + comments);
                      }
                      
                      try {
                        setDenying(true);
                        const { error } = await supabase.functions.invoke('punch-clock', {
                          body: {
                            action: 'review-change-request',
                            request_id: pendingChangeRequest.id,
                            status: 'rejected',
                            review_notes: auditDetails.join(' | ')
                          }
                        });
                        if (error) throw error;
                        toast({ title: 'Success', description: 'Change request denied' });
                        onOpenChange(false);
                      } catch (error: any) {
                        toast({ title: 'Error', description: error.message, variant: 'destructive' });
                      } finally {
                        setDenying(false);
                      }
                    }}
                    disabled={approving || denying}
                    variant="destructive"
                    className="flex-1 gap-2"
                    size="lg"
                  >
                    <X className="h-4 w-4" />
                    {denying ? 'Denying...' : 'Deny Change Request'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'details' | 'audit' | 'map')} className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="audit">
                <History className="h-4 w-4 mr-1" />
                Audit Trail
              </TabsTrigger>
              <TabsTrigger value="map">
                <MapPin className="h-4 w-4 mr-1" />
                Location Map
              </TabsTrigger>
            </TabsList>
            
            {isManager && (
              <Button 
                variant="outline" 
                onClick={() => setEditDialogOpen(true)}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Time Card
              </Button>
            )}
          </div>
          
          <TabsContent value="details" className="space-y-4 mt-6">
            {/* Main layout: Employee/Job info on left, Punch photos on right - 50/50 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left side: Combined Employee Information and Job & Time Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Employee Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Employee Details */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={employeeProfile?.avatar_url || timeCard.punch_out_photo_url || timeCard.punch_in_photo_url} />
                        <AvatarFallback>
                          {employeeProfile?.first_name?.[0]}{employeeProfile?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {employeeProfile?.display_name || `${employeeProfile?.first_name || ''} ${employeeProfile?.last_name || ''}`.trim() || 'Unknown'}
                        </p>
                        {profile?.email && <p className="text-sm text-muted-foreground">{profile.email}</p>}
                      </div>
                    </div>
                    
                    {profile?.phone && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Phone:</span>
                        <span className="text-sm font-medium">{profile.phone}</span>
                      </div>
                    )}
                    
                    {employeeProfile?.role && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Role:</span>
                        <span className="text-sm font-medium capitalize">{employeeProfile.role}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={pendingChangeRequest ? 'secondary' : getStatusColor(timeCard.status)}>
                          {pendingChangeRequest ? 'Pending Approval' : (timeCard.status === 'approved-edited' ? 'Approved (Edited)' : timeCard.status)}
                        </Badge>
                        {isManager && timeCard.status === 'submitted' && !pendingChangeRequest && (
                          <Button 
                            onClick={handleApproveTimeCard}
                            disabled={approving}
                            size="sm"
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            {approving ? 'Approving...' : 'Approve'}
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {timeCard.review_notes && (
                      <div className="p-2 bg-muted rounded-md">
                        <p className="text-sm text-muted-foreground">Review Notes:</p>
                        <p className="text-sm">{timeCard.review_notes}</p>
                      </div>
                    )}
                    
                    {/* Show if time card was edited after approval */}
                    {timeCard.status === 'approved-edited' && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Time Card Was Edited</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This time card was edited after submission. View the Audit Trail tab to see all changes.
                        </p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Job & Time Details */}
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Job & Time Details
                    </h4>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Job:</span>
                        <span className="text-sm font-medium">
                          {pendingChangeRequest?.proposed_job_id ? (
                            <span>
                              <span className="line-through text-red-600">{job?.name || 'N/A'}</span>
                              <span className="px-1">→</span>
                              <span className="text-green-600">{jobs[pendingChangeRequest.proposed_job_id]?.name || 'Unknown'}</span>
                            </span>
                          ) : (
                            job?.name || 'N/A'
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Cost Code:</span>
                        <span className="text-sm font-medium">
                          {pendingChangeRequest?.proposed_cost_code_id ? (
                            <span>
                              <span className="line-through text-red-600">
                                {costCode ? `${costCode.code} - ${costCode.description}` : 'N/A'}
                              </span>
                              <span className="px-1">→</span>
                              <span className="text-green-600">
                                {(() => {
                                  const cc = costCodes[pendingChangeRequest.proposed_cost_code_id];
                                  return cc ? `${cc.code} - ${cc.description}` : 'Unknown';
                                })()}
                              </span>
                            </span>
                          ) : (
                            costCode ? `${costCode.code} - ${costCode.description}` : 'N/A'
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Punch In:</span>
                        <span className="text-sm font-medium">
                          {pendingChangeRequest?.proposed_punch_in_time ? (
                            <span>
                              <span className="line-through text-red-600">{format(new Date(timeCard.punch_in_time), 'MMM dd, yyyy h:mm a')}</span>
                              <span className="px-1">→</span>
                              <span className="text-green-600">{format(new Date(pendingChangeRequest.proposed_punch_in_time), 'MMM dd, yyyy h:mm a')}</span>
                            </span>
                          ) : (
                            format(new Date(timeCard.punch_in_time), 'MMM dd, yyyy h:mm a')
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Punch Out:</span>
                        <span className="text-sm font-medium">
                          {pendingChangeRequest?.proposed_punch_out_time ? (
                            <span>
                              <span className="line-through text-red-600">
                                {timeCard.punch_out_time 
                                  ? format(new Date(timeCard.punch_out_time), 'MMM dd, yyyy h:mm a')
                                  : 'None'}
                              </span>
                              <span className="px-1">→</span>
                              <span className="text-green-600">{format(new Date(pendingChangeRequest.proposed_punch_out_time), 'MMM dd, yyyy h:mm a')}</span>
                            </span>
                          ) : (
                            timeCard.punch_out_time 
                              ? format(new Date(timeCard.punch_out_time), 'MMM dd, yyyy h:mm a')
                              : 'Still clocked in'
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Hours:</span>
                        <span className="text-sm font-medium">{timeCard.total_hours?.toFixed(2) || 'N/A'}</span>
                      </div>
                      {(timeCard.break_minutes > 0 || (timeCard.break_duration_minutes && timeCard.break_duration_minutes > 0)) && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Break Time:</span>
                          <span className="text-sm font-medium">
                            {timeCard.break_minutes || timeCard.break_duration_minutes} minutes
                          </span>
                        </div>
                      )}
                      {timeCard.overtime_hours && timeCard.overtime_hours > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Overtime:</span>
                          <span className="text-sm font-medium text-orange-500">
                            {timeCard.overtime_hours.toFixed(2)} hours
                          </span>
                        </div>
                      )}
                    </div>

                    {timeCard.notes && (
                      <div className="pt-2">
                        <p className="text-sm text-muted-foreground mb-1">Notes:</p>
                        <p className="text-sm">{timeCard.notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Right side: Punch Photos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Punch Photos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {timeCard.punch_in_photo_url && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Punch In Photo</p>
                        <div className="aspect-[4/3] relative overflow-hidden rounded-lg border bg-muted">
                          <img 
                            src={timeCard.punch_in_photo_url} 
                            alt="Punch in photo" 
                            className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.open(timeCard.punch_in_photo_url, '_blank')}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Taken at {formatTime(timeCard.punch_in_time)}
                        </p>
                      </div>
                    )}
                    
                    {timeCard.punch_out_photo_url && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Punch Out Photo</p>
                        <div className="aspect-[4/3] relative overflow-hidden rounded-lg border bg-muted">
                          <img 
                            src={timeCard.punch_out_photo_url} 
                            alt="Punch out photo" 
                            className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.open(timeCard.punch_out_photo_url, '_blank')}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Taken at {formatTime(timeCard.punch_out_time)}
                        </p>
                      </div>
                    )}

                    {!timeCard.punch_in_photo_url && !timeCard.punch_out_photo_url && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No photos available
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="audit" className="mt-6">
            <AuditTrailView timeCardId={timeCard.id} />
          </TabsContent>
          
          <TabsContent value="map" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Map
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  ref={mapContainer}
                  className="w-full h-[500px] rounded-lg border"
                />
                
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Job Site Location</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Punch In Location</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Punch Out Location</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>

        {canEdit && (
          <EditTimeCardDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            timeCardId={timeCard.id}
            onSave={() => {
              loadTimeCardDetails();
              setEditDialogOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
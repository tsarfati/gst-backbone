import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, MapPin, Camera, User, AlertTriangle, CheckCircle, X, Calendar, FileText, Edit, History } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { geocodeAddress } from '@/utils/geocoding';
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
  notes?: string;
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
  profiles?: { first_name: string; last_name: string; display_name: string };
  jobs?: { name: string; latitude?: number; longitude?: number };
  cost_codes?: { code: string; description: string; type?: string };
}

export default function TimeCardDetailView({ open, onOpenChange, timeCardId }: TimeCardDetailViewProps) {
  const { user, profile } = useAuth();
  const [timeCard, setTimeCard] = useState<TimeCardDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'audit' | 'map'>('details');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    if (open && timeCardId) {
      loadTimeCardDetails();
    }
  }, [open, timeCardId]);

  useEffect(() => {
    if (open && activeTab === 'map' && timeCard && mapContainer.current && !map.current) {
      initializeMap();
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
      const [profileData, pinEmployeeData, jobData, costCodeData, punchData] = await Promise.all([
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
        // Fetch punch records with buffer time to capture actual punch records
        (() => {
          const punchInBuffer = new Date(new Date(timeCardData.punch_in_time).getTime() - 30000).toISOString();
          const punchOutBuffer = timeCardData.punch_out_time 
            ? new Date(new Date(timeCardData.punch_out_time).getTime() + 30000).toISOString()
            : new Date().toISOString();
          
          return supabase
            .from('punch_records')
            .select('punch_type, latitude, longitude, photo_url, punch_time')
            .eq('user_id', timeCardData.user_id)
            .gte('punch_time', punchInBuffer)
            .lte('punch_time', punchOutBuffer)
            .order('punch_time', { ascending: true });
        })()
      ]);

      console.log('Time card data:', timeCardData);
      console.log('Punch records found:', punchData.data);

      // Backfill missing location and photo data from punch records
      const punchRecords = punchData.data || [];
      const punchIn = punchRecords.find(p => p.punch_type === 'punched_in');
      const punchOut = punchRecords.find(p => p.punch_type === 'punched_out');

      console.log('Punch in record:', punchIn);
      console.log('Punch out record:', punchOut);

      const normalizePhotoUrl = (url?: string | null) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        // Treat as a path inside the 'punch-photos' bucket
        const { data: publicData } = supabase.storage.from('punch-photos').getPublicUrl(url);
        return publicData?.publicUrl || null;
      };

      // Use profile data from either profiles or pin_employees
      const employeeProfile = profileData.data || pinEmployeeData.data;

      const data = {
        ...timeCardData,
        profiles: employeeProfile,
        jobs: jobData.data,
        cost_codes: costCodeData.data,
        // Ensure coordinates are numbers and backfill from punch records
        punch_in_location_lat: Number(timeCardData.punch_in_location_lat) || Number(punchIn?.latitude) || null,
        punch_in_location_lng: Number(timeCardData.punch_in_location_lng) || Number(punchIn?.longitude) || null,
        punch_out_location_lat: Number(timeCardData.punch_out_location_lat) || Number(punchOut?.latitude) || null,
        punch_out_location_lng: Number(timeCardData.punch_out_location_lng) || Number(punchOut?.longitude) || null,
        punch_in_photo_url: normalizePhotoUrl(timeCardData.punch_in_photo_url || punchIn?.photo_url || null),
        punch_out_photo_url: normalizePhotoUrl(timeCardData.punch_out_photo_url || punchOut?.photo_url || null),
      };

      console.log('Final time card data:', data);
      setTimeCard(data as any);
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
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Card Details
          </DialogTitle>
          <DialogDescription>
            {formatDate(timeCard.punch_in_time)}
          </DialogDescription>
        </DialogHeader>

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Details */}
              <div className="space-y-4">
                {/* Employee & Status Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Employee Information
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusColor(timeCard.status)}>
                          {timeCard.status.toUpperCase()}
                        </Badge>
                        {timeCard.distance_warning && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Distance Warning
                          </Badge>
                        )}
                        {!timeCard.requires_approval && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Auto-Approved
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-medium">{timeCard.profiles?.display_name || 'Unknown Employee'}</h4>
                      <p className="text-sm text-muted-foreground">
                        Entry Method: {timeCard.created_via_punch_clock ? 'Punch Clock' : 'Manual Entry'}
                      </p>
                    </div>
                    
                    {timeCard.correction_reason && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 text-yellow-800 mb-1">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">Correction Made</span>
                        </div>
                        <p className="text-sm text-yellow-700">{timeCard.correction_reason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Job & Time Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Job & Time Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Job</p>
                        <p className="font-medium">{timeCard.jobs?.name || 'Unknown Job'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Cost Code</p>
                        <p className="font-medium">
                          {timeCard.cost_codes?.code} - {timeCard.cost_codes?.description}
                          {timeCard.cost_codes?.type && ` (${timeCard.cost_codes.type})`}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Punch In</p>
                        <p className="font-medium">{formatTime(timeCard.punch_in_time)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Punch Out</p>
                        <p className="font-medium">{formatTime(timeCard.punch_out_time)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Hours</p>
                        <p className="font-bold text-lg">{timeCard.total_hours.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Overtime</p>
                        <p className="font-bold text-lg text-warning">{timeCard.overtime_hours.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Break</p>
                        <p className="font-bold text-lg">{timeCard.break_minutes} min</p>
                      </div>
                    </div>

                    {timeCard.distance_from_job_meters && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">
                          <strong>Distance from Job:</strong> {timeCard.distance_from_job_meters.toFixed(0)} meters
                        </p>
                      </div>
                    )}

                    {timeCard.notes && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Notes</p>
                        <p className="text-sm bg-muted/50 p-3 rounded-lg">{timeCard.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Photos - Always show this section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Punch Photos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(timeCard.punch_in_photo_url || timeCard.punch_out_photo_url) ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {timeCard.punch_in_photo_url && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Punch In Photo</p>
                            <div className="aspect-square relative overflow-hidden rounded-lg border bg-muted">
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
                            <div className="aspect-square relative overflow-hidden rounded-lg border bg-muted">
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
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No punch photos available for this time card</p>
                        <p className="text-xs mt-1">Photos are required for punch clock entries when enabled in settings</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
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

        <div className="flex justify-between gap-2 pt-4 border-t">
          <div className="flex gap-2">
            {(user?.id === timeCard.user_id || isManager) && (
              <Button 
                variant="outline"
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Time Card
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>

        <EditTimeCardDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          timeCardId={timeCard.id}
          onSave={() => {
            loadTimeCardDetails();
            setEditDialogOpen(false);
          }}
        />

        {/* Edit Dialog */}
        {isManager && (
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
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
  cost_codes?: { code: string; description: string };
}

export default function TimeCardDetailView({ open, onOpenChange, timeCardId }: TimeCardDetailViewProps) {
  const { user, profile } = useAuth();
  const [timeCard, setTimeCard] = useState<TimeCardDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    if (open && timeCardId) {
      loadTimeCardDetails();
    }
  }, [open, timeCardId]);

  useEffect(() => {
    if (open && timeCard && mapContainer.current && !map.current) {
      initializeMap();
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [open, timeCard]);

  const loadTimeCardDetails = async () => {
    if (!timeCardId) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('time_cards')
        .select(`
          *,
          profiles:user_id(first_name, last_name, display_name),
          jobs:job_id(name, latitude, longitude),
          cost_codes:cost_code_id(code, description)
        `)
        .eq('id', timeCardId)
        .single();

      if (error) throw error;

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
      // Get Mapbox token from Supabase secrets
      const { data } = await supabase.functions.invoke('get-mapbox-token');
      
      if (data?.MAPBOX_PUBLIC_TOKEN) {
        mapboxgl.accessToken = data.MAPBOX_PUBLIC_TOKEN;
      } else {
        console.error('Mapbox token not found');
        // Fallback token
        mapboxgl.accessToken = 'pk.eyJ1IjoibG92YWJsZSIsImEiOiJjbGJjM3JqdncwYnBiM29tc2NveWg2YnB1In0.DSvP8_hurZYK67HlqMVJOA';
      }
    } catch (error) {
      console.error('Error getting Mapbox token:', error);
      // Fallback token
      mapboxgl.accessToken = 'pk.eyJ1IjoibG92YWJsZSIsImEiOiJjbGJjM3JqdncwYnBiM29tc2NveWg2YnB1In0.DSvP8_hurZYK67HlqMVJOA';
    }

    // Center map on job location or punch locations
    let centerLat = timeCard.jobs?.latitude || timeCard.punch_in_location_lat || 0;
    let centerLng = timeCard.jobs?.longitude || timeCard.punch_in_location_lng || 0;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [centerLng, centerLat],
      zoom: 15
    });

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

        <Tabs defaultValue="details" className="w-full">
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

                {/* Photos */}
                {(timeCard.punch_in_photo_url || timeCard.punch_out_photo_url) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        Punch Photos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        {timeCard.punch_in_photo_url && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Punch In</p>
                            <img 
                              src={timeCard.punch_in_photo_url} 
                              alt="Punch in photo" 
                              className="w-full rounded-lg border"
                            />
                          </div>
                        )}
                        {timeCard.punch_out_photo_url && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Punch Out</p>
                            <img 
                              src={timeCard.punch_out_photo_url} 
                              alt="Punch out photo" 
                              className="w-full rounded-lg border"
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
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
                  className="w-full h-96 rounded-lg border"
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
      </DialogContent>
    </Dialog>
  );
}
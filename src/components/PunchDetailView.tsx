import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Clock, User, Camera, Globe, Monitor, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import { geocodeAddress } from '@/utils/geocoding';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface PunchDetailData {
  id: string;
  punch_time: string;
  punch_type: string;
  employee_name: string;
  job_name: string;
  cost_code: string;
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  ip_address?: string;
  user_agent?: string;
  notes?: string;
  job_latitude?: number;
  job_longitude?: number;
  job_address?: string;
  user_id?: string;
  job_id?: string;
  cost_code_id?: string;
  current_status_id?: string;
}

interface PunchDetailViewProps {
  punch: PunchDetailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPunchOut?: (userId: string) => void;
  showPunchOutButton?: boolean;
}

export default function PunchDetailView({ punch, open, onOpenChange, onPunchOut, showPunchOutButton }: PunchDetailViewProps) {
const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const jobMarker = useRef<mapboxgl.Marker | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [mapReady, setMapReady] = useState(false);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [displayCostCode, setDisplayCostCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open || !punch) return;
    
    // Get proper photo URL with signed URL if needed
    const loadPhotoUrl = async () => {
      if (punch.photo_url) {
        try {
          // If the URL is already a full HTTP URL, use it directly
          if (punch.photo_url.startsWith('http')) {
            setPhotoUrl(punch.photo_url);
          } else {
            // Get signed URL from Supabase storage
            const { data } = await supabase.storage
              .from('punch-photos')
              .createSignedUrl(punch.photo_url, 3600); // 1 hour expiry
            setPhotoUrl(data?.signedUrl || punch.photo_url);
          }
        } catch (error) {
          console.error('Error loading photo URL:', error);
          setPhotoUrl(punch.photo_url);
        }
      } else {
        setPhotoUrl(undefined);
      }
    };
    
    loadPhotoUrl();
  }, [open, punch]);

  // Resolve and display an accurate cost code if missing or unknown
  useEffect(() => {
    if (!open || !punch) return;
    setDisplayCostCode(punch.cost_code);

    const needsResolve = !punch.cost_code || punch.cost_code === 'Unknown Code' || punch.cost_code === 'No Cost Code';
    if (!needsResolve) return;

    const resolveCostCode = async () => {
      try {
        let codeId: string | undefined = punch.cost_code_id;
        console.log('[PunchDetailView] Resolving cost code. Initial cost_code_id:', { _type: typeof codeId, value: String(codeId) });

        // If no cost_code_id on the punch, try to find a matching time card for this punch time
        if (!codeId && punch.user_id && punch.punch_time) {
          const { data: tc, error: tcErr } = await supabase
            .from('time_cards')
            .select('id, cost_code_id, punch_in_time, punch_out_time')
            .eq('user_id', punch.user_id)
            .lte('punch_in_time', punch.punch_time)
            .gte('punch_out_time', punch.punch_time)
            .order('punch_in_time', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (tcErr) console.warn('[PunchDetailView] time_cards lookup warning:', tcErr);
          console.log('[PunchDetailView] Matched time card for punch time:', tc);
          codeId = (tc?.cost_code_id as string | null) || undefined;
        }

        // Fallback: use nearest prior punch with a cost_code_id
        if (!codeId && punch.user_id && punch.punch_time) {
          const { data: priorPunch, error: priorErr } = await supabase
            .from('punch_records')
            .select('cost_code_id, punch_type, punch_time')
            .eq('user_id', punch.user_id)
            .lte('punch_time', punch.punch_time)
            .not('cost_code_id', 'is', null)
            .order('punch_time', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (priorErr) console.warn('[PunchDetailView] prior punch lookup warning:', priorErr);
          if (priorPunch?.cost_code_id) {
            console.log('[PunchDetailView] Using prior punch cost_code_id:', priorPunch);
            codeId = priorPunch.cost_code_id as string;
          }
        }

        // Fallback: read current punch status (often holds selected job/cost code while active)
        if (!codeId && punch.user_id) {
          const { data: cps, error: cpsErr } = await supabase
            .from('current_punch_status')
            .select('id, cost_code_id, punch_in_time')
            .eq('user_id', punch.user_id)
            .eq('is_active', true)
            .order('punch_in_time', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (cpsErr) console.warn('[PunchDetailView] current_punch_status lookup warning:', cpsErr);
          if (cps?.cost_code_id) {
            console.log('[PunchDetailView] Using current_punch_status cost_code_id:', cps);
            codeId = cps.cost_code_id as string;
          }
        }

        // Fallback: latest time card started before this punch time (even if it ended earlier/later)
        if (!codeId && punch.user_id && punch.punch_time) {
          const { data: lastTc, error: lastTcErr } = await supabase
            .from('time_cards')
            .select('id, cost_code_id, punch_in_time, punch_out_time')
            .eq('user_id', punch.user_id)
            .lte('punch_in_time', punch.punch_time)
            .order('punch_in_time', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastTcErr) console.warn('[PunchDetailView] latest-before time_cards lookup warning:', lastTcErr);
          if (lastTc?.cost_code_id) {
            console.log('[PunchDetailView] Using latest-before time card cost_code_id:', lastTc);
            codeId = lastTc.cost_code_id as string;
          }
        }

        // Fallback: employee default timecard settings
        if (!codeId && punch.user_id) {
          const { data: settings, error: settingsErr } = await supabase
            .from('employee_timecard_settings')
            .select('default_cost_code_id')
            .eq('user_id', punch.user_id)
            .maybeSingle();
          if (settingsErr) console.warn('[PunchDetailView] employee_timecard_settings lookup warning:', settingsErr);
          if (settings?.default_cost_code_id) {
            console.log('[PunchDetailView] Using default_cost_code_id from settings:', settings);
            codeId = settings.default_cost_code_id as string;
          }
        }

        if (codeId) {
          const { data: code, error: codeErr } = await supabase
            .from('cost_codes')
            .select('code, description')
            .eq('id', codeId)
            .maybeSingle();
          if (codeErr) console.warn('[PunchDetailView] cost_codes lookup warning:', codeErr);
          console.log('[PunchDetailView] Resolved cost code row:', code);
          if (code) {
            setDisplayCostCode(`${code.code} - ${code.description}`);
          }
        }
      } catch (e) {
        console.warn('Failed to resolve cost code for punch detail:', e);
      }
    };

    resolveCostCode();
  }, [open, punch]);

  useEffect(() => {
    if (!open || !punch) return;

    (async () => {
      if (!mapContainer.current) return;
      
      // Initialize Mapbox
      setMapReady(false);
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) {
          console.warn('Error fetching Mapbox token:', error);
        }
        const token = data?.MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg';
        mapboxgl.accessToken = token;
        setMapToken(token);
        console.log('Mapbox token set successfully');
      } catch (e) {
        console.warn('Failed to fetch Mapbox token, using fallback:', e);
        const fallback = 'pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg';
        mapboxgl.accessToken = fallback;
        setMapToken(fallback);
      }

      // Determine job site coordinates first (from coords or by geocoding address)
      let jobLngLat: [number, number] | null = null;
      if (punch.job_latitude && punch.job_longitude) {
        jobLngLat = [Number(punch.job_longitude), Number(punch.job_latitude)];
      } else if (punch.job_address) {
        const geo = await geocodeAddress(punch.job_address);
        if (geo) jobLngLat = [geo.longitude, geo.latitude];
      }

      const hasPunchCoords =
        punch.latitude !== undefined && punch.latitude !== null &&
        punch.longitude !== undefined && punch.longitude !== null &&
        !Number.isNaN(Number(punch.latitude)) && !Number.isNaN(Number(punch.longitude));
      const punchLngLat: [number, number] | null = hasPunchCoords
        ? [Number(punch.longitude), Number(punch.latitude)]
        : null;

      // If we have neither punch nor job coords, do nothing
      if (!punchLngLat && !jobLngLat) return;

      // Create map if needed using the punch location if available, otherwise job location
      if (!map.current && mapContainer.current) {
        const center = punchLngLat || jobLngLat!;
        console.log('Creating map with center:', center, 'Punch coords:', punchLngLat, 'Job coords:', jobLngLat);
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center,
          zoom: punchLngLat ? 16 : 14, // Higher zoom for punch location
          projection: 'mercator'
        });
        
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Add error handling
        map.current.on('error', (e) => {
          console.error('Mapbox error:', e);
        });
        
        map.current.on('load', () => {
          console.log('Map loaded successfully');
          setMapReady(true);
          // Ensure proper sizing after dialog animation
          setTimeout(() => map.current?.resize(), 300);
        });
      }

      // Clear old markers
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
      if (jobMarker.current) {
        jobMarker.current.remove();
        jobMarker.current = null;
      }

      // Add punch marker if available
      if (punchLngLat && map.current) {
        marker.current = new mapboxgl.Marker({
          color: punch.punch_type === 'punched_in' ? '#10b981' : '#ef4444'
        })
          .setLngLat(punchLngLat)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div>
                  <strong>${punch.employee_name}</strong><br/>
                  <strong>Cost Code:</strong> ${displayCostCode || punch.cost_code || 'N/A'}<br/>
                  ${punch.punch_type === 'punched_in' ? 'Punched In' : 'Punched Out'}<br/>
                  ${format(new Date(punch.punch_time), 'PPpp')}
                </div>
              `)
          )
          .addTo(map.current);
      }

      // Add job marker if available
      if (jobLngLat && map.current) {
        jobMarker.current = new mapboxgl.Marker({ color: '#3b82f6' })
          .setLngLat(jobLngLat)
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<div><strong>${punch.job_name}</strong><br/>Job Site</div>`))
          .addTo(map.current);
      }

      // Fit bounds if we have both points
      if (map.current && punchLngLat && jobLngLat) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(punchLngLat);
        bounds.extend(jobLngLat);
        map.current.fitBounds(bounds, { padding: 40, maxZoom: 16 });
      }
    })();

    // Cleanup on close
    return () => {
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
      if (jobMarker.current) {
        jobMarker.current.remove();
        jobMarker.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [open, punch]);

  if (!punch) return null;

  const getPunchTypeColor = (type: string) => {
    return type === 'punched_in' ? 'default' : 'destructive';
  };

  const getBrowserInfo = (userAgent: string) => {
    if (!userAgent) return 'Unknown';
    
    // More detailed browser detection
    if (userAgent.includes('Edg/')) return 'Microsoft Edge';
    if (userAgent.includes('Chrome/') && !userAgent.includes('Chromium/')) return 'Google Chrome';
    if (userAgent.includes('Firefox/')) return 'Mozilla Firefox';
    if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) return 'Apple Safari';
    if (userAgent.includes('Opera/') || userAgent.includes('OPR/')) return 'Opera';
    if (userAgent.includes('Chromium/')) return 'Chromium';
    return 'Other Browser';
  };

  const getDeviceInfo = (userAgent: string) => {
    if (!userAgent) return 'Unknown Device';
    
    // Mobile detection
    if (/Android/i.test(userAgent)) return 'Android Device';
    if (/iPhone/i.test(userAgent)) return 'iPhone';
    if (/iPad/i.test(userAgent)) return 'iPad';
    if (/iPod/i.test(userAgent)) return 'iPod';
    if (/BlackBerry/i.test(userAgent)) return 'BlackBerry';
    if (/Windows Phone/i.test(userAgent)) return 'Windows Phone';
    
    // Desktop detection
    if (/Windows NT/i.test(userAgent)) return 'Windows Desktop';
    if (/Macintosh/i.test(userAgent)) return 'Mac Desktop';
    if (/Linux/i.test(userAgent)) return 'Linux Desktop';
    if (/X11/i.test(userAgent)) return 'Unix Desktop';
    
    // Generic mobile/tablet
    if (/Mobile|Tablet/i.test(userAgent)) return 'Mobile Device';
    
    return 'Desktop Computer';
  };

  const getOperatingSystem = (userAgent: string) => {
    if (!userAgent) return 'Unknown OS';
    
    if (/Windows NT 10.0/i.test(userAgent)) return 'Windows 10/11';
    if (/Windows NT 6.3/i.test(userAgent)) return 'Windows 8.1';
    if (/Windows NT 6.2/i.test(userAgent)) return 'Windows 8';
    if (/Windows NT 6.1/i.test(userAgent)) return 'Windows 7';
    if (/Windows NT/i.test(userAgent)) return 'Windows';
    
    if (/Mac OS X 10[._](\d+)/i.test(userAgent)) {
      const match = userAgent.match(/Mac OS X 10[._](\d+)/i);
      const version = match ? match[1] : '';
      return `macOS ${version}`;
    }
    if (/Mac OS X/i.test(userAgent)) return 'macOS';
    
    if (/Android (\d+\.\d+)/i.test(userAgent)) {
      const match = userAgent.match(/Android (\d+\.\d+)/i);
      const version = match ? match[1] : '';
      return `Android ${version}`;
    }
    if (/Android/i.test(userAgent)) return 'Android';
    
    if (/iPhone OS (\d+)_(\d+)/i.test(userAgent)) {
      const match = userAgent.match(/iPhone OS (\d+)_(\d+)/i);
      const version = match ? `${match[1]}.${match[2]}` : '';
      return `iOS ${version}`;
    }
    if (/iPhone/i.test(userAgent)) return 'iOS';
    
    if (/Linux/i.test(userAgent)) return 'Linux';
    
    return 'Unknown OS';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="flex-1">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Punch Record Details
            </DialogTitle>
            <DialogDescription>
              {format(new Date(punch.punch_time), 'PPpp')} • {punch.punch_type === 'punched_in' ? 'Punch In' : 'Punch Out'}
            </DialogDescription>
          </div>
          {showPunchOutButton && punch.punch_type === 'punched_in' && onPunchOut && punch.user_id && (
            <Button
              variant="destructive"
              onClick={() => onPunchOut(punch.user_id!)}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Punch Out
            </Button>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Punch Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Employee</span>
                <p className="font-medium">{punch.employee_name}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Type</span>
                <div>
                  <Badge variant={getPunchTypeColor(punch.punch_type)}>
                    {punch.punch_type === 'punched_in' ? 'Punch In' : 'Punch Out'}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Date & Time</span>
                <p className="font-medium">{format(new Date(punch.punch_time), 'PPpp')}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Job</span>
                <p className="font-medium">{punch.job_name}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Cost Code</span>
                <p className="font-medium">{displayCostCode || punch.cost_code || 'No Cost Code'}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">IP Address</span>
                <p className="font-medium">{punch.ip_address || 'Not recorded'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Device Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Device Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Browser</span>
                <p className="font-medium">{getBrowserInfo(punch.user_agent || '')}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Device Type</span>
                <p className="font-medium">{getDeviceInfo(punch.user_agent || '')}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Operating System</span>
                <p className="font-medium">{getOperatingSystem(punch.user_agent || '')}</p>
              </div>
              {punch.user_agent && (
                <div className="col-span-full">
                  <span className="text-sm text-muted-foreground">User Agent</span>
                  <p className="font-mono text-xs text-muted-foreground break-all bg-muted p-2 rounded">
                    {punch.user_agent}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location and Photo side by side */}
          {(((punch.latitude && punch.longitude) || (punch.job_latitude && punch.job_longitude) || punch.job_address) || photoUrl) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Location Information */}
              {((punch.latitude && punch.longitude) || (punch.job_latitude && punch.job_longitude) || punch.job_address) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {punch.latitude && punch.longitude ? (
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <span className="text-sm text-muted-foreground">Latitude</span>
                          <p className="font-medium">{Number(punch.latitude).toFixed(6)}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Longitude</span>
                          <p className="font-medium">{Number(punch.longitude).toFixed(6)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground mb-4">
                        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Location not recorded for this punch</p>
                      </div>
                    )}
                    
                    <div className="relative w-full h-[300px] rounded-md border overflow-hidden">
                      {/* Static placeholder while map loads */}
                      {!mapReady && ((punch.latitude && punch.longitude) || (punch.job_latitude && punch.job_longitude)) && (
                        <img
                          src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s-circle+${punch.punch_type === 'punched_in' ? '10b981' : 'ef4444'}(${punch.longitude || punch.job_longitude},${punch.latitude || punch.job_latitude})/${punch.longitude || punch.job_longitude},${punch.latitude || punch.job_latitude},15,0/600x300?access_token=${mapToken || 'pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg'}`}
                          alt="Map preview of punch location"
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}

                      {/* Live map fills the same placeholder */}
                      <div
                        ref={mapContainer}
                        className={`absolute inset-0 ${mapReady ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Photo */}
              {photoUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Photo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img 
                      src={photoUrl} 
                      alt="Punch photo" 
                      className="w-full h-[300px] object-cover rounded-md border"
                      onError={(e) => {
                        console.error('Photo failed to load:', photoUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Notes */}
          {punch.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{punch.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
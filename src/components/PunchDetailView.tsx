import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Clock, User, Camera, Globe, Monitor } from 'lucide-react';
import { format } from 'date-fns';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';

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
}

interface PunchDetailViewProps {
  punch: PunchDetailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PunchDetailView({ punch, open, onOpenChange }: PunchDetailViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!open || !punch || !punch.latitude || !punch.longitude || !mapContainer.current) return;

    // Initialize map with Mapbox token
    mapboxgl.accessToken = 'pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg';
    
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [punch.longitude, punch.latitude],
        zoom: 15,
        projection: 'mercator'
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    // Add or update marker
    if (marker.current) {
      marker.current.remove();
    }

    marker.current = new mapboxgl.Marker({
      color: punch.punch_type === 'punched_in' ? '#10b981' : '#ef4444'
    })
      .setLngLat([punch.longitude, punch.latitude])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div>
              <strong>${punch.employee_name}</strong><br/>
              <strong>Cost Code:</strong> ${punch.cost_code || 'N/A'}<br/>
              ${punch.punch_type === 'punched_in' ? 'Punched In' : 'Punched Out'}<br/>
              ${format(new Date(punch.punch_time), 'PPpp')}
            </div>
          `)
      )
      .addTo(map.current);

    // Cleanup on close
    return () => {
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
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
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  };

  const getDeviceInfo = (userAgent: string) => {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Punch Record Details
          </DialogTitle>
          <DialogDescription>
            {format(new Date(punch.punch_time), 'PPpp')} • {punch.punch_type === 'punched_in' ? 'Punch In' : 'Punch Out'}
          </DialogDescription>
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
                <p className="font-medium">{punch.cost_code || 'No Cost Code'}</p>
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
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Browser</span>
                <p className="font-medium">{getBrowserInfo(punch.user_agent || '')}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Device Type</span>
                <p className="font-medium">{getDeviceInfo(punch.user_agent || '')}</p>
              </div>
              {punch.user_agent && (
                <div className="col-span-2">
                  <span className="text-sm text-muted-foreground">User Agent</span>
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {punch.user_agent}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location Information */}
          {punch.latitude && punch.longitude && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Latitude</span>
                    <p className="font-medium">{punch.latitude.toFixed(6)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Longitude</span>
                    <p className="font-medium">{punch.longitude.toFixed(6)}</p>
                  </div>
                </div>
                
                <div 
                  ref={mapContainer} 
                  className="w-full h-64 rounded-md border"
                />
              </CardContent>
            </Card>
          )}

          {/* Photo */}
          {punch.photo_url && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <img 
                  src={punch.photo_url} 
                  alt="Punch photo" 
                  className="max-w-full h-auto rounded-md border"
                />
              </CardContent>
            </Card>
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
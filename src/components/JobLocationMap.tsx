import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface JobLocationMapProps {
  address?: string;
}

export default function JobLocationMap({ address }: JobLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mapbox token will be fetched from Supabase Edge Function

  // Geocode address to coordinates
  const geocodeAddress = async (addressString: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const { data: tokenResp } = await supabase.functions.invoke('get-mapbox-token');
      const token = tokenResp?.MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg';
      const encodedAddress = encodeURIComponent(addressString);
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${token}&limit=1`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }
      
      const geocodeData = await response.json();
      
      if (geocodeData.features && geocodeData.features.length > 0) {
        const [lng, lat] = geocodeData.features[0].center;
        return { lat, lng };
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Initialize map
  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      const { data: tokenResp } = await supabase.functions.invoke('get-mapbox-token');
      mapboxgl.accessToken = tokenResp?.MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg';
      
      // Default center (will be updated if address is geocoded)
      let center: [number, number] = [-98.5795, 39.8283]; // Center of US
      let zoom = 3;

      // If address is provided, try to geocode it
      if (address) {
        setIsLoading(true);
        const coordinates = await geocodeAddress(address);
        if (coordinates) {
          center = [coordinates.lng, coordinates.lat];
          zoom = 14;
        }
      }

      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom,
        interactive: false, // Disable all interactions
        dragPan: false,
        scrollZoom: false,
        boxZoom: false,
        dragRotate: false,
        keyboard: false,
        doubleClickZoom: false,
        touchZoomRotate: false
      });

      // Remove navigation controls since map is locked
      // map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add marker if we have coordinates
      if (address && zoom > 10) {
        marker.current = new mapboxgl.Marker({
          color: 'hsl(var(--primary))',
        })
          .setLngLat(center)
          .addTo(map.current);
      }

      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error('Map initialization error:', err);
      setError('Failed to initialize map');
      setIsLoading(false);
    }
  };

  // Auto-initialize map when component mounts if address is available
  useEffect(() => {
    if (address) {
      initializeMap();
    }
  }, [address]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (marker.current) {
        marker.current.remove();
      }
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  if (!address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No address specified for this job
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Job Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Address</p>
          <p className="text-foreground">{address}</p>
        </div>
        
        {isLoading && (
          <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        <div 
          ref={mapContainer} 
          className={`w-full h-[300px] rounded-lg overflow-hidden relative ${isLoading || error ? 'hidden' : ''}`}
          style={{ position: 'relative', width: '100%', height: '300px' }}
        />
      </CardContent>
    </Card>
  );
}
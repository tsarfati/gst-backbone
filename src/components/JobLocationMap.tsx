import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface JobLocationMapProps {
  address?: string;
}

export default function JobLocationMap({ address }: JobLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Geocode address to coordinates
  const geocodeAddress = async (addressString: string, token: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const encodedAddress = encodeURIComponent(addressString);
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${token}&limit=1`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        return { lat, lng };
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Initialize map
  const initializeMap = async (token: string) => {
    if (!mapContainer.current || !token) return;

    try {
      mapboxgl.accessToken = token;
      
      // Default center (will be updated if address is geocoded)
      let center: [number, number] = [-98.5795, 39.8283]; // Center of US
      let zoom = 3;

      // If address is provided, try to geocode it
      if (address) {
        setIsLoading(true);
        const coordinates = await geocodeAddress(address, token);
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
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

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

  // Handle token input
  const handleTokenSubmit = () => {
    if (mapboxToken.trim()) {
      initializeMap(mapboxToken.trim());
    }
  };

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
        
        {!map.current && !isLoading && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mapbox-token">Mapbox Public Token</Label>
              <Input
                id="mapbox-token"
                type="text"
                placeholder="Enter your Mapbox public token"
                value={mapboxToken}
                onChange={(e) => setMapboxToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTokenSubmit()}
              />
              <p className="text-xs text-muted-foreground">
                Get your token from{' '}
                <a 
                  href="https://mapbox.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  mapbox.com
                </a>
              </p>
            </div>
            <button
              onClick={handleTokenSubmit}
              disabled={!mapboxToken.trim()}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Load Map
            </button>
          </div>
        )}

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
          className={`w-full h-[300px] rounded-lg overflow-hidden ${!map.current ? 'hidden' : ''}`}
        />
      </CardContent>
    </Card>
  );
}
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JobLocationMapProps {
  address: string;
  jobName: string;
  className?: string;
}

const JobLocationMap: React.FC<JobLocationMapProps> = ({ address, jobName, className }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Geocode the address to get coordinates
  const geocodeAddress = async (address: string) => {
    if (!address || address.trim() === '') {
      setError('No address provided');
      setLoading(false);
      return;
    }

    try {
      // Note: In a real implementation, you would use your Mapbox token from Supabase secrets
      // For now, we'll use a placeholder and show how to set it up
      const mapboxToken = 'pk.placeholder'; // This should come from Supabase secrets
      
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&limit=1`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        setCoordinates([lng, lat]);
      } else {
        setError('Address not found');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setError('Failed to load location');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    geocodeAddress(address);
  }, [address]);

  useEffect(() => {
    if (!mapContainer.current || !coordinates) return;

    // Initialize map
    // Note: This token should come from your Supabase Edge Function secrets
    mapboxgl.accessToken = 'pk.placeholder'; // Replace with actual token from secrets

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: coordinates,
      zoom: 15,
      pitch: 0,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Add a marker for the job location
    new mapboxgl.Marker({
      color: '#1976d2', // Material Design primary blue
      scale: 1.2
    })
      .setLngLat(coordinates)
      .setPopup(
        new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div class="p-2">
              <h3 class="font-semibold text-sm">${jobName}</h3>
              <p class="text-xs text-gray-600">${address}</p>
            </div>
          `)
      )
      .addTo(map.current);

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [coordinates, jobName, address]);

  const openInMaps = () => {
    if (coordinates) {
      const [lng, lat] = coordinates;
      const url = `https://www.google.com/maps?q=${lat},${lng}`;
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <Card className={`animate-fade-in ${className}`} elevation={2}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Job Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-md flex items-center justify-center">
            <div className="text-muted-foreground">Loading map...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !coordinates) {
    return (
      <Card className={`animate-fade-in ${className}`} elevation={2}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Job Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-md flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-sm">
                {error || 'Unable to load map'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Address: {address}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`animate-fade-in ${className}`} elevation={2}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Job Location
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={openInMaps}
            className="flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Open in Maps
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-3">
          <p className="font-medium text-sm">{jobName}</p>
          <p className="text-xs text-muted-foreground">{address}</p>
        </div>
        <div 
          ref={mapContainer} 
          className="h-64 rounded-md border border-border overflow-hidden md-elevation-1" 
        />
      </CardContent>
    </Card>
  );
};

export default JobLocationMap;
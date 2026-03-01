import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';

interface PhotoLocationMapProps {
  latitude: number;
  longitude: number;
  className?: string;
}

export default function PhotoLocationMap({ latitude, longitude, className }: PhotoLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        if (data?.MAPBOX_PUBLIC_TOKEN) {
          setMapboxToken(data.MAPBOX_PUBLIC_TOKEN);
        } else {
          // Fallback token
          setMapboxToken('pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg');
        }
      } catch (error) {
        console.warn('Error getting Mapbox token, using fallback:', error);
        setMapboxToken('pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg');
      }
    };
    fetchToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;
    if (map.current) return; // Already initialized

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [longitude, latitude],
      zoom: 15,
      interactive: false,
    });

    // Add marker at photo location
    new mapboxgl.Marker({ color: '#E88A2D' })
      .setLngLat([longitude, latitude])
      .addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken, latitude, longitude]);

  if (!mapboxToken) {
    return (
      <div className={`bg-muted rounded-lg flex items-center justify-center ${className}`}>
        <span className="text-muted-foreground text-sm">Loading map...</span>
      </div>
    );
  }

  return (
    <div ref={mapContainer} className={`rounded-lg overflow-hidden ${className}`} />
  );
}

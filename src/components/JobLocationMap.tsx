import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface JobLocationMapProps {
  address?: string;
}

interface ForecastDay {
  date: string;
  minTemp: number;
  maxTemp: number;
  weatherCode: number;
  precipitationChance: number;
}

const getWeatherLabel = (code: number): string => {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Mixed';
};

const getWeatherIcon = (code: number): string => {
  if (code === 0) return '☀️';
  if ([1, 2].includes(code)) return '⛅';
  if (code === 3) return '☁️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '🌤️';
};

export default function JobLocationMap({ address }: JobLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

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
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }

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
          setCoordinates(coordinates);
        } else {
          setCoordinates(null);
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

  const loadForecast = async (lat: number, lng: number) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`
      );
      if (!response.ok) throw new Error('Failed to fetch weather');
      const data = await response.json();
      const daily = data?.daily;
      if (!daily?.time || !daily?.temperature_2m_max || !daily?.temperature_2m_min || !daily?.weather_code) {
        throw new Error('Weather data unavailable');
      }

      const mapped: ForecastDay[] = daily.time.map((date: string, idx: number) => ({
        date,
        minTemp: Number(daily.temperature_2m_min[idx] ?? 0),
        maxTemp: Number(daily.temperature_2m_max[idx] ?? 0),
        weatherCode: Number(daily.weather_code[idx] ?? 0),
        precipitationChance: Number(daily.precipitation_probability_max?.[idx] ?? 0),
      }));

      setForecast(mapped.slice(0, 7));
    } catch (err) {
      console.error('Weather forecast error:', err);
      setWeatherError('Unable to load weather forecast');
      setForecast([]);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Auto-initialize map when component mounts if address is available
  useEffect(() => {
    if (address) {
      initializeMap();
    }
  }, [address]);

  useEffect(() => {
    if (!coordinates) {
      setForecast([]);
      return;
    }
    loadForecast(coordinates.lat, coordinates.lng);
  }, [coordinates]);

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

        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium text-muted-foreground">7-Day Forecast</p>

          {weatherLoading && (
            <div className="text-sm text-muted-foreground">Loading forecast...</div>
          )}

          {!weatherLoading && weatherError && (
            <div className="text-sm text-muted-foreground">{weatherError}</div>
          )}

          {!weatherLoading && !weatherError && forecast.length > 0 && (
            <div className="space-y-1.5">
              {forecast.map((day) => (
                <div
                  key={day.date}
                  className="grid grid-cols-[78px_1fr_auto] items-center gap-2 rounded-md border px-2.5 py-2"
                >
                  <span className="text-xs text-muted-foreground">
                    {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="text-sm truncate">
                    {getWeatherIcon(day.weatherCode)} {getWeatherLabel(day.weatherCode)}
                    {day.precipitationChance > 0 ? ` · ${Math.round(day.precipitationChance)}% rain` : ''}
                  </span>
                  <span className="text-xs font-medium whitespace-nowrap">
                    {Math.round(day.maxTemp)}° / {Math.round(day.minTemp)}°
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

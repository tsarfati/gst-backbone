import { supabase } from "@/integrations/supabase/client";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address.trim()) return null;

  try {
    // Get Mapbox token from Supabase secrets first
    let mapboxToken: string;
    
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (data?.MAPBOX_PUBLIC_TOKEN) {
        mapboxToken = data.MAPBOX_PUBLIC_TOKEN;
      } else {
        // Fallback token
        mapboxToken = 'pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg';
      }
    } catch (error) {
      console.warn('Error getting Mapbox token from Supabase, using fallback:', error);
      mapboxToken = 'pk.eyJ1IjoibXRzYXJmYXRpIiwiYSI6ImNtZnN5d2UyNTBwNzQyb3B3M2k2YWpmNnMifQ.7IGj882ISgFZt7wgGLBTKg';
    }

    // Use Mapbox Geocoding API
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1&types=address,place`
    );

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [longitude, latitude] = feature.center;
      
      return {
        latitude,
        longitude,
        formatted_address: feature.place_name
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
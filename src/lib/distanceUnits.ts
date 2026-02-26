export type DistanceUnitPreference = "meters" | "feet";

const METERS_TO_FEET = 3.28084;

export function metersToFeet(meters: number): number {
  return meters * METERS_TO_FEET;
}

export function formatDistanceLabel(
  meters: number,
  unit: DistanceUnitPreference,
  opts?: { compact?: boolean; decimals?: number }
): string {
  const compact = opts?.compact ?? false;
  const decimals = opts?.decimals ?? 0;

  if (unit === "feet") {
    const feet = metersToFeet(meters);
    const rounded = decimals > 0 ? feet.toFixed(decimals) : Math.round(feet).toString();
    return compact ? `${rounded}ft` : `${rounded} feet`;
  }

  const rounded = decimals > 0 ? meters.toFixed(decimals) : Math.round(meters).toString();
  return compact ? `${rounded}m` : `${rounded} meters`;
}


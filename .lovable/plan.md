
# Fix: Browser Tab Favicon Changing to Wrong Icon

## Problem Identified

The browser tab favicon (the BuilderLynk logo you uploaded) is being replaced with a "PC in green square" icon after navigating to a few pages. This happens because:

1. **The `useDynamicManifest` hook replaces favicons**: When you navigate within the main app, this hook runs in `AppLayout.tsx` and removes all existing favicon `<link>` tags, replacing them with new paths pointing to `/assets/company-icon-192.png`

2. **Service Worker not active in preview**: The service worker that's supposed to serve these icons is explicitly disabled in the Lovable preview environment (see `main.tsx`). Without the service worker, requests to `/assets/company-icon-*` return either a placeholder or fail

3. **Fallback icon appears**: When the proper icon can't be loaded, the browser may show a cached fallback or error icon (the "PC in green square")

## Solution

Separate the favicon behavior for the **main BuilderLynk app** from the **Punch Clock PWA**:

1. **Preserve the main app's favicon** - Stop `useDynamicManifest` from replacing the favicon in the main app (only needed for Punch Clock pages)

2. **Only run dynamic icons on Punch Clock routes** - The company-specific icon feature should only activate on `/punch-clock-*` and `/pm-mobile-*` routes

3. **Add a stable favicon fallback** - Ensure the main `/favicon.png` is never removed when browsing the main app

## Technical Changes

### File: `src/hooks/useDynamicManifest.ts`

Update the hook to only replace favicon links when on Punch Clock-related routes:

- Add a check for the current route before modifying document head
- If not on a Punch Clock route, skip the icon replacement entirely
- This keeps the original BuilderLynk favicon stable on main app pages

### File: `src/components/AppLayout.tsx`

Remove the `useDynamicManifest()` call from AppLayout since it's not needed for the main app navigation. The hook should only be used in:
- `PunchClockLogin.tsx`
- `PunchClockApp.tsx`  
- `PMobileLogin.tsx`
- `PMobileApp.tsx`
- `EmployeeDashboard.tsx` (if it uses PWA features)

## Expected Result

After this fix:
- The BuilderLynk favicon will remain stable throughout main app navigation
- The dynamic company icons will only apply to Punch Clock and PM Mobile pages
- No more "PC in green square" appearing when navigating between pages

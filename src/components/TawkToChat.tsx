import { useEffect } from 'react';

/**
 * Tawk.to live chat widget.
 * 
 * To set up:
 * 1. Create a free account at https://www.tawk.to
 * 2. Get your Property ID and Widget ID from the dashboard
 * 3. Replace the placeholder IDs below
 * 
 * The embed URL format is: https://embed.tawk.to/{PROPERTY_ID}/{WIDGET_ID}
 */

const TAWK_PROPERTY_ID = 'YOUR_PROPERTY_ID';
const TAWK_WIDGET_ID = 'YOUR_WIDGET_ID';

export function TawkToChat() {
  useEffect(() => {
    // Don't load if IDs haven't been configured
    if (TAWK_PROPERTY_ID === 'YOUR_PROPERTY_ID') return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`;
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
      // Clean up tawk globals
      const tawkElements = document.querySelectorAll('[id^="tawk-"]');
      tawkElements.forEach((el) => el.remove());
    };
  }, []);

  return null;
}

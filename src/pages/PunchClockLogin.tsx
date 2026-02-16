import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { useDynamicManifest } from '@/hooks/useDynamicManifest';
import builderlynkLogo from '@/assets/builderlynk-hero-logo.png';

interface LoginSettings {
  header_image_url?: string;
  background_color?: string;
  background_image_url?: string;
  primary_color?: string;
  logo_url?: string;
  welcome_message?: string;
  bottom_text?: string;
  menu_transparency?: number;
}

export default function PunchClockLogin() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginSettings, setLoginSettings] = useState<LoginSettings>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load dynamic manifest
  useDynamicManifest();

  useEffect(() => {
    loadLoginSettings();
  }, []);

  const loadLoginSettings = async (companyId?: string) => {
    try {
      console.log('Loading punch clock login settings for company:', companyId);
      
      // Only load settings if we have a specific company ID
      // This ensures we show default BuilderLYNK branding when accessed from landing page
      if (!companyId) {
        console.log('No company ID provided, using default BuilderLYNK branding');
        setLoginSettings({});
        return;
      }
      
      const { data, error } = await supabase
        .from('punch_clock_login_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      console.log('Login settings response:', { data, error });

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading login settings:', error);
        return;
      }

      if (data) {
        console.log('Loaded login settings:', data);
        setLoginSettings(data);
      } else {
        console.log('No login settings found for company, using defaults');
        setLoginSettings({});
      }
    } catch (error) {
      console.error('Error loading login settings:', error);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin.length !== 6) {
      toast({
        title: "Invalid PIN",
        description: "Please enter a 6-digit PIN",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Attempting PIN login with:', pin);
      
      // Validate PIN via secure RPC to avoid RLS issues - check both regular profiles and PIN employees
      const { data: pinRows, error: pinError } = await supabase.rpc('validate_pin_for_login', { p_pin: pin });

      console.log('PIN validation result:', pinRows, 'error:', pinError);

      const profiles = pinRows?.[0];

      if (pinError || !profiles) {
        console.log('PIN validation failed');
        toast({
          title: "Invalid PIN",
          description: "PIN not found or invalid",
          variant: "destructive",
        });
        return;
      }

      // Get company_id from the profile
      const companyId = (profiles as any)?.current_company_id ?? (profiles as any)?.company_id ?? null;
      
      // Create a temporary session for PIN-based login
      // Note: This is a simplified approach - in production you might want 
      // to implement a more secure token-based system
      localStorage.setItem('punch_clock_user', JSON.stringify({
        user_id: profiles.user_id,
        name: `${profiles.first_name} ${profiles.last_name}`,
        role: profiles.role,
        current_company_id: companyId,
        pin_authenticated: true,
        pin
      }));
      
      // Load login settings for this user's company to apply theming
      if (companyId) {
        await loadLoginSettings(companyId);
      }

      toast({
        title: "Login Successful",
        description: `Welcome, ${profiles.first_name}!`,
      });

      // Small delay to ensure localStorage is set before navigation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate with window.location for full page reload to ensure auth context picks up PIN
      window.location.href = '/punch-clock-app';
    } catch (error) {
      console.error('Error during PIN login:', error);
      toast({
        title: "Login Failed",
        description: "An error occurred during login",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (value: string) => {
    // Only allow digits and limit to 6 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setPin(digitsOnly);
  };

  const backgroundColor = loginSettings.background_color || '#0f1419';
  
  // Handle HSL color values from design system
  const getPrimaryColor = (color: string) => {
    if (!color) return '#E88A2D'; // Default to BuilderLYNK orange
    // If it's already a hex color, return as is
    if (color.startsWith('#')) return color;
    // If it's HSL values like "120 60% 45%", convert to hsl()
    if (color.includes('%')) return `hsl(${color})`;
    return color;
  };
  
  const primaryColor = getPrimaryColor(loginSettings.primary_color || '#E88A2D');

  // Create background style - prefer image over color
  const backgroundStyle = loginSettings.background_image_url
    ? {
        backgroundImage: `url(${loginSettings.background_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }
    : { backgroundColor };

  // Check if using default (no company-specific settings loaded)
  const isDefaultBranding = !loginSettings.logo_url && !loginSettings.header_image_url && !loginSettings.background_color;

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={isDefaultBranding ? { background: 'linear-gradient(135deg, #0f1419 0%, #1a1f2e 100%)' } : backgroundStyle}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Default BuilderLYNK branding when no company settings */}
        {isDefaultBranding && (
          <div className="text-center">
            <img 
              src={builderlynkLogo} 
              alt="BuilderLYNK" 
              className="mx-auto h-24 object-contain mb-2"
            />
            <h1 className="text-3xl font-black">
              <span className="text-white">Builder</span><span className="text-[#E88A2D]">LYNK</span>
            </h1>
            <p className="text-white/70 text-sm mt-1">Employee Punch Clock</p>
          </div>
        )}

        {/* Header Image - company specific */}
        {!isDefaultBranding && loginSettings.header_image_url && (
          <div className="text-center">
            <img 
              src={loginSettings.header_image_url} 
              alt="Header" 
              className="mx-auto max-h-32 object-contain"
            />
          </div>
        )}

        {/* Logo - company specific */}
        {!isDefaultBranding && loginSettings.logo_url && (
          <div className="text-center">
            <img 
              src={loginSettings.logo_url} 
              alt="Company Logo" 
              className="mx-auto h-16 w-16 object-contain"
            />
          </div>
        )}

        <Card className="shadow-lg" style={{ opacity: (loginSettings.menu_transparency ?? 100) / 100 }}>
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold">
              {loginSettings.welcome_message || 'Welcome to Punch Clock'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinLogin} className="space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-medium">Enter your 6-digit PIN</label>
                {/* PIN Dots */}
                <div className="flex justify-between gap-2">
                  {[0,1,2,3,4,5].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-10 flex-1 rounded-md border flex items-center justify-center",
                        pin.length > i ? "bg-primary/10 border-primary/30" : "bg-muted"
                      )}
                    >
                      <span className="font-semibold tracking-widest select-none">
                        {pin[i] ? "•" : ""}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {["1","2","3","4","5","6","7","8","9","C","0","⌫"].map((key) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      className="h-12 text-lg"
                      onClick={() => {
                        if (key === "C") return setPin("");
                        if (key === "⌫") return setPin((p) => p.slice(0, -1));
                        if (pin.length < 6) setPin((p) => p + key);
                      }}
                    >
                      {key}
                    </Button>
                  ))}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full text-lg py-6"
                disabled={loading || pin.length !== 6}
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <LogIn className="h-5 w-5 mr-2" />
                )}
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            {/* Customizable bottom text */}
            {loginSettings.bottom_text && (
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {loginSettings.bottom_text}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
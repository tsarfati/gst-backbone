import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LoginSettings {
  header_image_url?: string;
  background_color?: string;
  background_image_url?: string;
  primary_color?: string;
  logo_url?: string;
  welcome_message?: string;
}

export default function PunchClockLogin() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginSettings, setLoginSettings] = useState<LoginSettings>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadLoginSettings();
  }, []);

  const loadLoginSettings = async () => {
    try {
      console.log('Loading punch clock login settings...');
      
      // Load settings for the first available company
      // In most cases, there will be only one company
      const { data, error } = await supabase
        .from('punch_clock_login_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
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
        console.log('No login settings found, using defaults');
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
      
      // Validate PIN via secure RPC to avoid RLS issues
      const { data: pinRows, error: pinError } = await supabase.rpc('validate_pin', { p_pin: pin });

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

      // Create a temporary session for PIN-based login
      // Note: This is a simplified approach - in production you might want 
      // to implement a more secure token-based system
      localStorage.setItem('punch_clock_user', JSON.stringify({
        user_id: profiles.user_id,
        name: `${profiles.first_name} ${profiles.last_name}`,
        role: profiles.role,
        pin_authenticated: true
      }));

      toast({
        title: "Login Successful",
        description: `Welcome, ${profiles.first_name}!`,
      });

      navigate('/punch-clock-app');
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

  const backgroundColor = loginSettings.background_color || '#f8fafc';
  
  // Handle HSL color values from design system
  const getPrimaryColor = (color: string) => {
    if (!color) return '#3b82f6';
    // If it's already a hex color, return as is
    if (color.startsWith('#')) return color;
    // If it's HSL values like "120 60% 45%", convert to hsl()
    if (color.includes('%')) return `hsl(${color})`;
    return color;
  };
  
  const primaryColor = getPrimaryColor(loginSettings.primary_color || '#3b82f6');

  // Create background style - prefer image over color
  const backgroundStyle = loginSettings.background_image_url
    ? {
        backgroundImage: `url(${loginSettings.background_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }
    : { backgroundColor };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={backgroundStyle}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Header Image */}
        {loginSettings.header_image_url && (
          <div className="text-center">
            <img 
              src={loginSettings.header_image_url} 
              alt="Header" 
              className="mx-auto max-h-32 object-contain"
            />
          </div>
        )}

        {/* Logo */}
        {loginSettings.logo_url && (
          <div className="text-center">
            <img 
              src={loginSettings.logo_url} 
              alt="Company Logo" 
              className="mx-auto h-16 w-16 object-contain"
            />
          </div>
        )}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold">
              {loginSettings.welcome_message || 'Welcome to Punch Clock'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pin" className="text-sm font-medium">
                  Enter your 6-digit PIN
                </label>
                <Input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => handlePinInput(e.target.value)}
                  placeholder="••••••"
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoComplete="off"
                />
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

            <div className="mt-6 text-center">
              <Button
                variant="link"
                onClick={() => navigate('/auth')}
                className="text-sm text-muted-foreground"
              >
                Need regular access? Sign in here
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LoginSettings {
  header_image_url?: string;
  background_color?: string;
  background_image_url?: string;
  primary_color?: string;
  logo_url?: string;
  welcome_message?: string;
  bottom_text?: string;
}

export default function PMobileLogin() {
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
      const { data, error } = await supabase
        .from('punch_clock_login_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading login settings:', error);
        return;
      }

      if (data) {
        setLoginSettings(data);
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
      const { data: pinRows, error: pinError } = await supabase.rpc('validate_pin_for_login', { p_pin: pin });

      const profiles = pinRows?.[0];

      if (pinError || !profiles) {
        toast({
          title: "Invalid PIN",
          description: "PIN not found or invalid",
          variant: "destructive",
        });
        return;
      }

      // Normalize and verify role access
      const normalizedRole = String(profiles.role || '').toLowerCase().trim();
      const allowedRoles = new Set(['project_manager', 'admin', 'controller']);
      if (!allowedRoles.has(normalizedRole)) {
        toast({
          title: "Access Denied",
          description: "This app is only for Project Managers, Admins, and Controllers",
          variant: "destructive",
        });
        return;
      }

      // Store PIN session for PM Mobile
      localStorage.setItem('pm_mobile_user', JSON.stringify({
        user_id: profiles.user_id,
        name: `${profiles.first_name} ${profiles.last_name}`,
        role: normalizedRole,
        pin_authenticated: true,
        pin
      }));

      toast({
        title: "Login Successful",
        description: `Welcome, ${profiles.first_name}!`,
      });

      navigate('/pm-mobile-app', { replace: true });
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
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setPin(digitsOnly);
  };

  const backgroundColor = loginSettings.background_color || '#f8fafc';
  
  const getPrimaryColor = (color: string) => {
    if (!color) return '#3b82f6';
    if (color.startsWith('#')) return color;
    if (color.includes('%')) return `hsl(${color})`;
    return color;
  };
  
  const primaryColor = getPrimaryColor(loginSettings.primary_color || '#3b82f6');

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
        {loginSettings.header_image_url && (
          <div className="text-center">
            <img 
              src={loginSettings.header_image_url} 
              alt="Header" 
              className="mx-auto max-h-32 object-contain"
            />
          </div>
        )}

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
              {loginSettings.welcome_message || 'Project Manager Mobile'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinLogin} className="space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-medium">Enter your 6-digit PIN</label>
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

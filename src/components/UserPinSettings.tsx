import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserPinSettingsProps {
  userId: string;
  currentPin?: string;
  userName: string;
}

export function UserPinSettings({ userId, currentPin, userName }: UserPinSettingsProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateRandomPin = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setPin(randomPin);
    setConfirmPin(randomPin);
  };

  const handleSavePin = async () => {
    if (pin.length !== 6) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 6 digits",
        variant: "destructive",
      });
      return;
    }

    if (pin !== confirmPin) {
      toast({
        title: "PIN Mismatch",
        description: "PIN and confirmation must match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pin_code: pin })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "PIN Updated",
        description: `PIN successfully set for ${userName}`,
      });

      setPin('');
      setConfirmPin('');
    } catch (error) {
      console.error('Error updating PIN:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update PIN",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (value: string, setter: (value: string) => void) => {
    // Only allow digits and limit to 6 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setter(digitsOnly);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Set PIN for {userName}
          {currentPin && (
            <Badge variant="secondary">PIN Set</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pin">6-Digit PIN</Label>
          <Input
            id="pin"
            type="password"
            value={pin}
            onChange={(e) => handlePinInput(e.target.value, setPin)}
            placeholder="••••••"
            className="text-center text-lg tracking-widest"
            maxLength={6}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-pin">Confirm PIN</Label>
          <Input
            id="confirm-pin"
            type="password"
            value={confirmPin}
            onChange={(e) => handlePinInput(e.target.value, setConfirmPin)}
            placeholder="••••••"
            className="text-center text-lg tracking-widest"
            maxLength={6}
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={generateRandomPin}
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate Random
          </Button>
          <Button
            onClick={handleSavePin}
            disabled={loading || pin.length !== 6 || pin !== confirmPin}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save PIN'}
          </Button>
        </div>

        {currentPin && (
          <p className="text-sm text-muted-foreground text-center">
            This user already has a PIN set. Setting a new PIN will overwrite the existing one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
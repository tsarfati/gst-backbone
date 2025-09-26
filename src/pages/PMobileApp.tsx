import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, FileText, Scan, Upload, CheckCircle, User, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PMReceiptScanner } from '@/components/PMReceiptScanner';
import { DeliveryTicketForm } from '@/components/DeliveryTicketForm';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

function PMobileApp() {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: 'Sign Out Error',
        description: 'There was an issue signing out. Please try again.',
        variant: 'destructive'
      });
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-accent/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-accent/20 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="secondary" className="text-xs">
                Project Manager
              </Badge>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                className="h-8 w-8 p-0"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 justify-center mb-2">
              <User className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">
                {profile?.display_name || profile?.first_name || 'Project Manager'}
              </span>
            </div>
            <div className="text-3xl font-bold text-primary">
              {currentTime.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
            <div className="text-sm text-muted-foreground">
              {currentTime.toLocaleDateString([], { 
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </CardHeader>
        </Card>

        {/* Main Content */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardContent className="p-0">
            <Tabs defaultValue="scanner" className="w-full">
              <TabsList className="grid w-full grid-cols-2 m-4 mb-0">
                <TabsTrigger value="scanner" className="flex items-center gap-2">
                  <Scan className="h-4 w-4" />
                  Receipt Scanner
                </TabsTrigger>
                <TabsTrigger value="delivery" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Delivery Ticket
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="scanner" className="p-4 space-y-4">
                <div className="text-center mb-6">
                  <Camera className="h-12 w-12 text-primary mx-auto mb-2" />
                  <h3 className="text-lg font-semibold mb-1">Receipt Scanner</h3>
                  <p className="text-sm text-muted-foreground">
                    Take a photo of receipts and code them to jobs
                  </p>
                </div>
                <PMReceiptScanner />
              </TabsContent>
              
              <TabsContent value="delivery" className="p-4 space-y-4">
                <div className="text-center mb-6">
                  <FileText className="h-12 w-12 text-primary mx-auto mb-2" />
                  <h3 className="text-lg font-semibold mb-1">Delivery Ticket</h3>
                  <p className="text-sm text-muted-foreground">
                    Record material deliveries on site
                  </p>
                </div>
                <DeliveryTicketForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary mb-1">
                <Upload className="h-6 w-6 mx-auto mb-1" />
                0
              </div>
              <div className="text-xs text-muted-foreground">
                Today's Uploads
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                <CheckCircle className="h-6 w-6 mx-auto mb-1" />
                0
              </div>
              <div className="text-xs text-muted-foreground">
                Tickets Processed
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick Access</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start h-12"
              onClick={() => navigate('/jobs')}
            >
              <FileText className="h-4 w-4 mr-3" />
              View All Jobs
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-12"
              onClick={() => navigate('/receipts')}
            >
              <Scan className="h-4 w-4 mr-3" />
              Coded Receipts
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-12"
              onClick={() => navigate('/delivery-tickets')}
            >
              <FileText className="h-4 w-4 mr-3" />
              All Delivery Tickets
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PMobileApp;
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, Pause, Square, Timer, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

interface TimeEntry {
  id: string;
  project: string;
  task: string;
  startTime: string;
  endTime?: string;
  duration: number;
  status: 'running' | 'paused' | 'completed';
}

export default function TimeTracking() {
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Load today's time entries
    loadTimeEntries();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentEntry?.status === 'running') {
      interval = setInterval(() => {
        const start = new Date(currentEntry.startTime).getTime();
        const now = new Date().getTime();
        setCurrentTime(Math.floor((now - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentEntry]);

  const loadTimeEntries = () => {
    // Mock data for demonstration
    const mockEntries: TimeEntry[] = [
      {
        id: '1',
        project: 'Office Renovation',
        task: 'Planning and Design',
        startTime: '2024-01-15T08:00:00Z',
        endTime: '2024-01-15T10:30:00Z',
        duration: 9000, // 2.5 hours in seconds
        status: 'completed'
      },
      {
        id: '2',
        project: 'Warehouse Project',
        task: 'Material Review',
        startTime: '2024-01-15T11:00:00Z',
        endTime: '2024-01-15T12:00:00Z',
        duration: 3600, // 1 hour in seconds
        status: 'completed'
      }
    ];
    setTimeEntries(mockEntries);
  };

  const startTimer = (project: string, task: string) => {
    const newEntry: TimeEntry = {
      id: Date.now().toString(),
      project,
      task,
      startTime: new Date().toISOString(),
      duration: 0,
      status: 'running'
    };
    setCurrentEntry(newEntry);
    setCurrentTime(0);
    toast({
      title: 'Timer Started',
      description: `Started tracking time for ${task}`,
    });
  };

  const pauseTimer = () => {
    if (currentEntry) {
      setCurrentEntry({ ...currentEntry, status: 'paused' });
      toast({
        title: 'Timer Paused',
        description: 'Time tracking has been paused',
      });
    }
  };

  const resumeTimer = () => {
    if (currentEntry) {
      setCurrentEntry({ ...currentEntry, status: 'running' });
      toast({
        title: 'Timer Resumed',
        description: 'Time tracking has been resumed',
      });
    }
  };

  const stopTimer = () => {
    if (currentEntry) {
      const completedEntry = {
        ...currentEntry,
        endTime: new Date().toISOString(),
        duration: currentTime,
        status: 'completed' as const
      };
      setTimeEntries(prev => [completedEntry, ...prev]);
      setCurrentEntry(null);
      setCurrentTime(0);
      toast({
        title: 'Timer Stopped',
        description: `Logged ${formatDuration(currentTime)} for ${currentEntry.task}`,
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalTime = () => {
    return timeEntries.reduce((total, entry) => total + entry.duration, 0) + currentTime;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-7 w-7" />
          Time Tracking
        </h1>
        <p className="text-muted-foreground">
          Track your time across different projects and tasks
        </p>
      </div>

      {/* Current Timer */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Current Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentEntry ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{currentEntry.project}</h3>
                <p className="text-muted-foreground">{currentEntry.task}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-mono font-bold">
                  {formatDuration(currentTime)}
                </div>
                <Badge variant={currentEntry.status === 'running' ? 'default' : 'secondary'}>
                  {currentEntry.status.toUpperCase()}
                </Badge>
              </div>
              <div className="flex gap-2">
                {currentEntry.status === 'running' ? (
                  <Button onClick={pauseTimer} variant="outline">
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                ) : (
                  <Button onClick={resumeTimer}>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                )}
                <Button onClick={stopTimer} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No active timer</h3>
              <p className="text-muted-foreground mb-4">Start tracking time for a project</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => startTimer('Office Renovation', 'Planning and Design')}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Timer
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today's Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(getTotalTime())}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Entries Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timeEntries.length + (currentEntry ? 1 : 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeEntries.length > 0 
                ? formatDuration(Math.floor(timeEntries.reduce((sum, entry) => sum + entry.duration, 0) / timeEntries.length))
                : '00:00:00'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No time entries for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{entry.project}</h4>
                    <p className="text-sm text-muted-foreground">{entry.task}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.startTime).toLocaleTimeString()} - {entry.endTime ? new Date(entry.endTime).toLocaleTimeString() : 'In Progress'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold">{formatDuration(entry.duration)}</div>
                    <Badge variant="outline">{entry.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, Filter, Download, Users, Clock, Calendar, Phone, Building2, MapPin, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';

interface VisitorLog {
  id: string;
  visitor_name: string;
  visitor_phone: string;
  company_name?: string;
  check_in_time: string;
  check_out_time?: string;
  purpose_of_visit?: string;
  notes?: string;
  subcontractor?: {
    company_name: string;
    contact_person?: string;
  };
}

interface VisitorReportsProps {
  jobId: string;
  jobName: string;
}

export function VisitorReports({ jobId, jobName }: VisitorReportsProps) {
  const { toast } = useToast();
  const [visitors, setVisitors] = useState<VisitorLog[]>([]);
  const [filteredVisitors, setFilteredVisitors] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorLog | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadVisitorLogs();
  }, [jobId]);

  useEffect(() => {
    applyFilters();
  }, [visitors, searchTerm, dateFilter, statusFilter]);

  const loadVisitorLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('visitor_logs')
        .select(`
          *
        `)
        .eq('job_id', jobId)
        .order('check_in_time', { ascending: false });

      if (error) throw error;

      // Fetch subcontractor data separately to avoid relation errors
      const visitorData = data || [];
      const subcontractorIds = visitorData
        .map(v => v.subcontractor_id)
        .filter(Boolean);

      let subcontractorMap: Record<string, { company_name: string; contact_person?: string }> = {};

      if (subcontractorIds.length > 0) {
        const { data: subcontractorData } = await supabase
          .from('job_subcontractors')
          .select('id, company_name, contact_person')
          .in('id', subcontractorIds);

        if (subcontractorData) {
          subcontractorMap = subcontractorData.reduce((acc, sub) => {
            acc[sub.id] = { company_name: sub.company_name, contact_person: sub.contact_person };
            return acc;
          }, {} as Record<string, { company_name: string; contact_person?: string }>);
        }
      }

      // Map subcontractor data to visitors
      const visitorsWithSubcontractors = visitorData.map(visitor => ({
        ...visitor,
        subcontractor: visitor.subcontractor_id ? subcontractorMap[visitor.subcontractor_id] : undefined
      }));

      setVisitors(visitorsWithSubcontractors);
    } catch (error) {
      console.error('Error loading visitor logs:', error);
      toast({
        title: "Error",
        description: "Failed to load visitor logs.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...visitors];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(visitor =>
        visitor.visitor_name.toLowerCase().includes(search) ||
        visitor.visitor_phone.includes(search) ||
        (visitor.company_name || '').toLowerCase().includes(search) ||
        (visitor.subcontractor?.company_name || '').toLowerCase().includes(search)
      );
    }

    // Date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (dateFilter !== 'all') {
      filtered = filtered.filter(visitor => {
        const checkInDate = parseISO(visitor.check_in_time);
        switch (dateFilter) {
          case 'today':
            return checkInDate >= today;
          case 'yesterday':
            return checkInDate >= yesterday && checkInDate < today;
          case 'week':
            return checkInDate >= thisWeek;
          default:
            return true;
        }
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(visitor => {
        const isCheckedOut = visitor.check_out_time !== null;
        return statusFilter === 'checked_in' ? !isCheckedOut : isCheckedOut;
      });
    }

    setFilteredVisitors(filtered);
  };

  const handleCheckOut = async (visitorId: string) => {
    try {
      const { error } = await supabase
        .from('visitor_logs')
        .update({ check_out_time: new Date().toISOString() })
        .eq('id', visitorId);

      if (error) throw error;

      toast({
        title: "Check-out Successful",
        description: "Visitor has been checked out successfully.",
      });

      loadVisitorLogs();
    } catch (error) {
      console.error('Error checking out visitor:', error);
      toast({
        title: "Check-out Failed",
        description: "Failed to check out visitor. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Name',
      'Phone',
      'Company',
      'Check In Time',
      'Check Out Time',
      'Duration',
      'Purpose',
      'Notes'
    ];

    const csvData = filteredVisitors.map(visitor => {
      const checkIn = parseISO(visitor.check_in_time);
      const checkOut = visitor.check_out_time ? parseISO(visitor.check_out_time) : null;
      const duration = checkOut ? 
        `${Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60))} minutes` : 
        'Still on site';

      return [
        visitor.visitor_name,
        visitor.visitor_phone,
        visitor.company_name || visitor.subcontractor?.company_name || '',
        format(checkIn, 'yyyy-MM-dd HH:mm:ss'),
        checkOut ? format(checkOut, 'yyyy-MM-dd HH:mm:ss') : '',
        duration,
        visitor.purpose_of_visit || '',
        visitor.notes || ''
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitor-log-${jobName}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getVisitorStatus = (visitor: VisitorLog) => {
    return visitor.check_out_time ? 'checked_out' : 'on_site';
  };

  const calculateDuration = (checkIn: string, checkOut?: string) => {
    const start = parseISO(checkIn);
    const end = checkOut ? parseISO(checkOut) : new Date();
    const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading visitor reports...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Visitor Log - {jobName}</span>
          </h3>
          <p className="text-muted-foreground">
            Track and manage job site visitors
          </p>
        </div>
        <Button onClick={exportToCSV} disabled={filteredVisitors.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Visitors</p>
                <p className="text-2xl font-bold">{visitors.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Currently On Site</p>
                <p className="text-2xl font-bold text-green-600">
                  {visitors.filter(v => !v.check_out_time).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Today's Visitors</p>
                <p className="text-2xl font-bold text-blue-600">
                  {visitors.filter(v => {
                    const today = new Date();
                    const checkIn = parseISO(v.check_in_time);
                    return checkIn.toDateString() === today.toDateString();
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="checked_in">On Site</SelectItem>
                  <SelectItem value="checked_out">Checked Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visitor Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visitor</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No visitors found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredVisitors.map((visitor) => (
                  <TableRow key={visitor.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{visitor.visitor_name}</p>
                        <p className="text-sm text-muted-foreground flex items-center">
                          <Phone className="h-3 w-3 mr-1" />
                          {visitor.visitor_phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                        {visitor.company_name || visitor.subcontractor?.company_name || 'Not specified'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {format(parseISO(visitor.check_in_time), 'MMM d, h:mm a')}
                        </p>
                        {visitor.check_out_time && (
                          <p className="text-sm text-muted-foreground">
                            Out: {format(parseISO(visitor.check_out_time), 'h:mm a')}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                        {calculateDuration(visitor.check_in_time, visitor.check_out_time)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getVisitorStatus(visitor) === 'on_site' ? 'default' : 'secondary'}>
                        {getVisitorStatus(visitor) === 'on_site' ? 'On Site' : 'Checked Out'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedVisitor(visitor)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Visitor Details</DialogTitle>
                            </DialogHeader>
                            {selectedVisitor && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm font-medium">Name</Label>
                                    <p>{selectedVisitor.visitor_name}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Phone</Label>
                                    <p>{selectedVisitor.visitor_phone}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Company</Label>
                                    <p>{selectedVisitor.company_name || selectedVisitor.subcontractor?.company_name || 'Not specified'}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Status</Label>
                                    <Badge variant={getVisitorStatus(selectedVisitor) === 'on_site' ? 'default' : 'secondary'}>
                                      {getVisitorStatus(selectedVisitor) === 'on_site' ? 'On Site' : 'Checked Out'}
                                    </Badge>
                                  </div>
                                </div>
                                
                                <div>
                                  <Label className="text-sm font-medium">Check In Time</Label>
                                  <p>{format(parseISO(selectedVisitor.check_in_time), 'MMMM d, yyyy at h:mm a')}</p>
                                </div>
                                
                                {selectedVisitor.check_out_time && (
                                  <div>
                                    <Label className="text-sm font-medium">Check Out Time</Label>
                                    <p>{format(parseISO(selectedVisitor.check_out_time), 'MMMM d, yyyy at h:mm a')}</p>
                                  </div>
                                )}
                                
                                {selectedVisitor.purpose_of_visit && (
                                  <div>
                                    <Label className="text-sm font-medium">Purpose of Visit</Label>
                                    <p>{selectedVisitor.purpose_of_visit}</p>
                                  </div>
                                )}
                                
                                {selectedVisitor.notes && (
                                  <div>
                                    <Label className="text-sm font-medium">Notes</Label>
                                    <p>{selectedVisitor.notes}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>

                        {getVisitorStatus(visitor) === 'on_site' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCheckOut(visitor.id)}
                          >
                            Check Out
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
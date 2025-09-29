import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, Download, User, Clock, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  user_id: string;
  user_email?: string;
  user_name?: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

export default function AuditLog() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7'); // days

  useEffect(() => {
    if (currentCompany) {
      loadAuditLog();
    }
  }, [currentCompany, dateRange]);

  const loadAuditLog = async () => {
    if (!currentCompany) return;

    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(dateRange));

      // Get audit entries from various audit tables
      const auditQueries = [
        // Time card audit
        supabase
          .from('time_card_audit_trail')
          .select(`
            id,
            time_card_id,
            changed_by,
            change_type,
            field_name,
            old_value,
            new_value,
            reason,
            created_at
          `)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false }),

        // Invoice audit
        supabase
          .from('invoice_audit_trail')
          .select(`
            id,
            invoice_id,
            changed_by,
            change_type,
            field_name,
            old_value,
            new_value,
            reason,
            created_at
          `)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false }),

        // Delivery ticket audit
        supabase
          .from('delivery_ticket_audit')
          .select(`
            id,
            delivery_ticket_id,
            changed_by,
            change_type,
            field_name,
            old_value,
            new_value,
            reason,
            created_at
          `)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
      ];

      const [timeCardAudit, invoiceAudit, deliveryTicketAudit] = await Promise.all(auditQueries);

      // Get user profiles for user names
      const allUserIds = new Set<string>();
      
      if (timeCardAudit.data) {
        timeCardAudit.data.forEach(entry => entry.changed_by && allUserIds.add(entry.changed_by));
      }
      if (invoiceAudit.data) {
        invoiceAudit.data.forEach(entry => entry.changed_by && allUserIds.add(entry.changed_by));
      }
      if (deliveryTicketAudit.data) {
        deliveryTicketAudit.data.forEach(entry => entry.changed_by && allUserIds.add(entry.changed_by));
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, display_name')
        .in('user_id', Array.from(allUserIds));

      const userMap = new Map();
      profiles?.forEach(profile => {
        userMap.set(profile.user_id, {
          name: profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User'
        });
      });

      // Combine and format all audit entries
      const combinedEntries: AuditEntry[] = [];

      // Process time card audit entries
      timeCardAudit.data?.forEach(entry => {
        combinedEntries.push({
          id: entry.id,
          table_name: 'time_cards',
          record_id: entry.time_card_id,
          action: entry.change_type,
          old_values: entry.old_value ? { [entry.field_name || 'status']: entry.old_value } : undefined,
          new_values: entry.new_value ? { [entry.field_name || 'status']: entry.new_value } : undefined,
          user_id: entry.changed_by,
          user_name: userMap.get(entry.changed_by)?.name || 'Unknown User',
          created_at: entry.created_at
        });
      });

      // Process invoice audit entries
      invoiceAudit.data?.forEach(entry => {
        combinedEntries.push({
          id: entry.id,
          table_name: 'invoices',
          record_id: entry.invoice_id,
          action: entry.change_type,
          old_values: entry.old_value ? { [entry.field_name || 'status']: entry.old_value } : undefined,
          new_values: entry.new_value ? { [entry.field_name || 'status']: entry.new_value } : undefined,
          user_id: entry.changed_by,
          user_name: userMap.get(entry.changed_by)?.name || 'Unknown User',
          created_at: entry.created_at
        });
      });

      // Process delivery ticket audit entries
      deliveryTicketAudit.data?.forEach(entry => {
        combinedEntries.push({
          id: entry.id,
          table_name: 'delivery_tickets',
          record_id: entry.delivery_ticket_id,
          action: entry.change_type,
          old_values: entry.old_value ? { [entry.field_name || 'status']: entry.old_value } : undefined,
          new_values: entry.new_value ? { [entry.field_name || 'status']: entry.new_value } : undefined,
          user_id: entry.changed_by,
          user_name: userMap.get(entry.changed_by)?.name || 'Unknown User',
          created_at: entry.created_at
        });
      });

      // Sort by date descending
      combinedEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAuditEntries(combinedEntries);
    } catch (error) {
      console.error('Error loading audit log:', error);
      toast({
        title: "Error",
        description: "Failed to load audit log",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'default';
      case 'update':
        return 'secondary';
      case 'delete':
        return 'destructive';
      case 'approve':
        return 'default';
      case 'reject':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getTableDisplayName = (tableName: string) => {
    switch (tableName) {
      case 'time_cards':
        return 'Time Cards';
      case 'invoices':
        return 'Bills/Invoices';
      case 'delivery_tickets':
        return 'Delivery Tickets';
      case 'jobs':
        return 'Jobs';
      case 'vendors':
        return 'Vendors';
      case 'receipts':
        return 'Receipts';
      default:
        return tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const filteredEntries = auditEntries.filter(entry => {
    const matchesSearch = 
      entry.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || entry.action.toLowerCase() === actionFilter.toLowerCase();
    const matchesTable = tableFilter === 'all' || entry.table_name === tableFilter;
    
    return matchesSearch && matchesAction && matchesTable;
  });

  const exportAuditLog = () => {
    const csvContent = [
      ['Date/Time', 'User', 'Action', 'Table', 'Record ID', 'Changes'].join(','),
      ...filteredEntries.map(entry => [
        format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss'),
        entry.user_name || 'Unknown',
        entry.action,
        getTableDisplayName(entry.table_name),
        entry.record_id,
        entry.new_values ? JSON.stringify(entry.new_values) : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${currentCompany?.name}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading audit log...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Company Audit Log</h3>
          <p className="text-sm text-muted-foreground">
            Track all user actions and changes for {currentCompany?.display_name || currentCompany?.name}
          </p>
        </div>
        <Button onClick={exportAuditLog} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Log
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user, table, or action..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last day</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tables</SelectItem>
                  <SelectItem value="time_cards">Time Cards</SelectItem>
                  <SelectItem value="invoices">Bills/Invoices</SelectItem>
                  <SelectItem value="delivery_tickets">Delivery Tickets</SelectItem>
                  <SelectItem value="jobs">Jobs</SelectItem>
                  <SelectItem value="vendors">Vendors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Entries ({filteredEntries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No audit entries found</h3>
              <p className="text-muted-foreground">
                {searchTerm || actionFilter !== 'all' || tableFilter !== 'all' 
                  ? "Try adjusting your search or filters"
                  : "No user actions recorded in the selected time period"
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm:ss')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{entry.user_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(entry.action)}>
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{getTableDisplayName(entry.table_name)}</span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.record_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {entry.new_values && (
                        <div className="max-w-xs">
                          <div className="text-sm">
                            {Object.entries(entry.new_values).map(([key, value]) => (
                              <div key={key} className="truncate">
                                <span className="font-medium">{key}:</span> {String(value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
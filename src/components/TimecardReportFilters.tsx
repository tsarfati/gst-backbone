import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, MapPin, Search, Users, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
}

interface Job {
  id: string;
  name: string;
  address?: string;
}

interface EmployeeGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

interface FilterState {
  employees: string[];
  groups: string[];
  jobs: string[];
  startDate?: Date;
  endDate?: Date;
  locations: string[];
  hasNotes: boolean;
  hasOvertime: boolean;
  status: string[];
  showDeleted: boolean;
  showNotes: boolean;
}

interface TimecardReportFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  employees: Employee[];
  jobs: Job[];
  groups: EmployeeGroup[];
  onApplyFilters: () => void;
  onClearFilters: () => void;
  loading?: boolean;
}

export default function TimecardReportFilters({
  filters,
  onFiltersChange,
  employees,
  jobs,
  groups,
  onApplyFilters,
  onClearFilters,
  loading = false
}: TimecardReportFiltersProps) {
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    // Load unique locations from jobs
    const uniqueLocations = [...new Set(jobs.map(job => job.address).filter(Boolean))];
    setLocations(uniqueLocations);
  }, [jobs]);

  const updateFilters = (updates: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const toggleEmployee = (employeeId: string) => {
    const updated = filters.employees.includes(employeeId)
      ? filters.employees.filter(id => id !== employeeId)
      : [...filters.employees, employeeId];
    updateFilters({ employees: updated });
  };

  const toggleJob = (jobId: string) => {
    const updated = filters.jobs.includes(jobId)
      ? filters.jobs.filter(id => id !== jobId)
      : [...filters.jobs, jobId];
    updateFilters({ jobs: updated });
  };

  const toggleLocation = (location: string) => {
    const updated = filters.locations.includes(location)
      ? filters.locations.filter(loc => loc !== location)
      : [...filters.locations, location];
    updateFilters({ locations: updated });
  };

  const toggleStatus = (status: string) => {
    const updated = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    updateFilters({ status: updated });
  };

  const toggleGroup = (groupId: string) => {
    const updated = filters.groups.includes(groupId)
      ? filters.groups.filter(id => id !== groupId)
      : [...filters.groups, groupId];
    updateFilters({ groups: updated });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.employees.length > 0) count++;
    if (filters.groups.length > 0) count++;
    if (filters.jobs.length > 0) count++;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    if (filters.locations.length > 0) count++;
    if (filters.hasNotes) count++;
    if (filters.hasOvertime) count++;
    if (filters.status.length > 0) count++;
    if (filters.showDeleted) count++;
    return count;
  };

  const statusOptions = [
    { value: 'approved', label: 'Approved' },
    { value: 'pending', label: 'Pending' },
    { value: 'corrected', label: 'Corrected' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary">{getActiveFiltersCount()} active</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button size="sm" onClick={onApplyFilters} disabled={loading}>
              {loading ? 'Loading...' : 'Apply Filters'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.startDate ? format(filters.startDate, "PPP") : "Select start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.startDate}
                  onSelect={(date) => updateFilters({ startDate: date })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.endDate ? format(filters.endDate, "PPP") : "Select end date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.endDate}
                  onSelect={(date) => updateFilters({ endDate: date })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Employee Groups Selection */}
        {groups.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Employee Groups ({filters.groups.length} selected)
            </Label>
            <div className="flex gap-2 mb-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => updateFilters({ groups: groups.map(g => g.id) })}
              >
                Select All
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => updateFilters({ groups: [] })}
              >
                Clear All
              </Button>
            </div>
            <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="space-y-2">
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={filters.groups.includes(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                    />
                    <Label htmlFor={`group-${group.id}`} className="text-sm flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: group.color || '#3b82f6' }}
                      />
                      {group.name}
                      {group.description && (
                        <span className="text-muted-foreground">- {group.description}</span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Employee Selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Individual Employees ({filters.employees.length} selected)
          </Label>
          <div className="flex gap-2 mb-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => updateFilters({ employees: employees.map(emp => emp.user_id) })}
            >
              Select All
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => updateFilters({ employees: [] })}
            >
              Clear All
            </Button>
          </div>
          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
            <div className="space-y-2">
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`employee-${employee.id}`}
                    checked={filters.employees.includes(employee.user_id)}
                    onCheckedChange={() => toggleEmployee(employee.user_id)}
                  />
                  <Label htmlFor={`employee-${employee.id}`} className="text-sm">
                    {employee.display_name || `${employee.first_name} ${employee.last_name}`}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Job Selection */}
        <div className="space-y-2">
          <Label>Jobs ({filters.jobs.length} selected)</Label>
          <div className="flex gap-2 mb-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => updateFilters({ jobs: jobs.map(job => job.id) })}
            >
              Select All
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => updateFilters({ jobs: [] })}
            >
              Clear All
            </Button>
          </div>
          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`job-${job.id}`}
                    checked={filters.jobs.includes(job.id)}
                    onCheckedChange={() => toggleJob(job.id)}
                  />
                  <Label htmlFor={`job-${job.id}`} className="text-sm">
                    {job.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Location Selection */}
        {locations.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Locations ({filters.locations.length} selected)
            </Label>
            <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="space-y-2">
                {locations.map((location) => (
                  <div key={location} className="flex items-center space-x-2">
                    <Checkbox
                      id={`location-${location}`}
                      checked={filters.locations.includes(location)}
                      onCheckedChange={() => toggleLocation(location)}
                    />
                    <Label htmlFor={`location-${location}`} className="text-sm">
                      {location}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Status Selection */}
        <div className="space-y-2">
          <Label>Status ({filters.status.length} selected)</Label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <div key={status.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${status.value}`}
                  checked={filters.status.includes(status.value)}
                  onCheckedChange={() => toggleStatus(status.value)}
                />
                <Label htmlFor={`status-${status.value}`} className="text-sm">
                  {status.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Filters */}
        <div className="space-y-3">
          <Label>Additional Filters</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has-notes"
                checked={filters.hasNotes}
                onCheckedChange={(checked) => updateFilters({ hasNotes: !!checked })}
              />
              <Label htmlFor="has-notes" className="text-sm">
                Only records with notes
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has-overtime"
                checked={filters.hasOvertime}
                onCheckedChange={(checked) => updateFilters({ hasOvertime: !!checked })}
              />
              <Label htmlFor="has-overtime" className="text-sm">
                Only records with overtime
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-deleted"
                checked={filters.showDeleted}
                onCheckedChange={(checked) => updateFilters({ showDeleted: !!checked })}
              />
              <Label htmlFor="show-deleted" className="text-sm">
                Show deleted records
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-notes"
                checked={filters.showNotes}
                onCheckedChange={(checked) => updateFilters({ showNotes: !!checked })}
              />
              <Label htmlFor="show-notes" className="text-sm">
                Show notes column in reports
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
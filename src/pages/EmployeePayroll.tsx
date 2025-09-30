import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default function EmployeePayroll() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Employee Payroll</h1>
        <p className="text-muted-foreground">Manage employee payroll and compensation</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Payroll management features coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

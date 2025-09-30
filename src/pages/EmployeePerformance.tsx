import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function EmployeePerformance() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Employee Performance</h1>
        <p className="text-muted-foreground">Track and review employee performance metrics</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Performance tracking features coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

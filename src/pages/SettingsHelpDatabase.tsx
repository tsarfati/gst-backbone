import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsHelpDatabase = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Help & Support</h1>
      <Card>
        <CardHeader>
          <CardTitle>Help Center</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            For assistance, please contact your system administrator or reach out to BuilderLYNK support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsHelpDatabase;

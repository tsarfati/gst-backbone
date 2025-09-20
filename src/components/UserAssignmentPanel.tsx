import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { UserCheck, Users, MessageCircle } from "lucide-react";

const users = [
  { id: "1", name: "John Smith", role: "Project Manager" },
  { id: "2", name: "Sarah Wilson", role: "Accountant" },
  { id: "3", name: "Mike Johnson", role: "Site Supervisor" },
  { id: "4", name: "Emily Davis", role: "Controller" },
  { id: "5", name: "Current User", role: "Admin" }
];

interface UserAssignmentPanelProps {
  receiptId: string;
  assignedUser?: { id: string; name: string; role: string };
  onAssignUser: (userId: string, userName: string, userRole: string) => void;
  onUnassignUser: () => void;
}

export default function UserAssignmentPanel({ 
  receiptId, 
  assignedUser, 
  onAssignUser, 
  onUnassignUser 
}: UserAssignmentPanelProps) {
  const handleAssignUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      onAssignUser(user.id, user.name, user.role);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assign for Review
            </Label>
            {assignedUser && (
              <Badge variant="secondary" className="text-xs">
                Assigned
              </Badge>
            )}
          </div>

          {assignedUser ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <div className="font-medium text-sm">{assignedUser.name}</div>
                  <div className="text-xs text-muted-foreground">{assignedUser.role}</div>
                </div>
                <UserCheck className="h-4 w-4 text-success" />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onUnassignUser}
                  className="flex-1"
                >
                  Unassign
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                >
                  <MessageCircle className="h-3 w-3 mr-1" />
                  Message
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Select onValueChange={handleAssignUser}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select user to assign" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-md z-50">
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id} className="cursor-pointer">
                      <div className="flex items-center justify-between w-full">
                        <span>{user.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{user.role}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <p className="text-xs text-muted-foreground">
                Assign this receipt to a user for review and coding. They will be notified and can add comments.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Clock } from "lucide-react";
import { useState } from "react";

export interface ReceiptMessage {
  id: string;
  receiptId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'assignment' | 'coding' | 'status';
}

interface ReceiptMessagingPanelProps {
  receiptId: string;
  messages: ReceiptMessage[];
  onSendMessage: (message: string) => void;
  currentUserId: string;
  currentUserName: string;
}

export default function ReceiptMessagingPanel({ 
  receiptId, 
  messages, 
  onSendMessage,
  currentUserId,
  currentUserName 
}: ReceiptMessagingPanelProps) {
  const [newMessage, setNewMessage] = useState("");

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return '👤';
      case 'coding':
        return '✅';
      case 'status':
        return '📝';
      default:
        return '💬';
    }
  };

  const receiptMessages = messages.filter(msg => msg.receiptId === receiptId);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Receipt Discussion
          {receiptMessages.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {receiptMessages.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4">
          {receiptMessages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-center">
              <div>
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground">Start a discussion about this receipt</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {receiptMessages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs">
                      {message.userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{message.userName}</span>
                      <span className="text-xs text-muted-foreground">
                        {getMessageIcon(message.type)}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {message.timestamp.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                    
                    <div className={`text-sm p-3 rounded-lg ${
                      message.userId === currentUserId 
                        ? 'bg-primary text-primary-foreground ml-4' 
                        : 'bg-muted'
                    }`}>
                      {message.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Textarea
                placeholder="Add a message about this receipt..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="min-h-[60px] resize-none"
                rows={2}
              />
            </div>
            <Button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              size="sm"
              className="self-end h-[60px]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              Press Shift+Enter for new line, Enter to send
            </p>
            <p className="text-xs text-muted-foreground">
              {newMessage.length}/500
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
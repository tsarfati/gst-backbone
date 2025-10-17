import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Comment {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

interface UserProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface BillInternalNotesProps {
  billId: string;
  existingNotes?: any;
}

export default function BillInternalNotes({ billId, existingNotes }: BillInternalNotesProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const { toast } = useToast();

  useEffect(() => {
    loadComments();
  }, [billId, existingNotes]);

  const loadComments = async () => {
    setLoading(true);
    try {
      // Parse existing notes
      let parsedComments: Comment[] = [];
      if (existingNotes) {
        if (Array.isArray(existingNotes)) {
          parsedComments = existingNotes;
        } else if (typeof existingNotes === 'string') {
          try {
            parsedComments = JSON.parse(existingNotes);
          } catch {
            // If it's a string but not JSON, treat it as a single comment
            parsedComments = [];
          }
        }
      }

      setComments(parsedComments);

      // Load user profiles for all commenters
      if (parsedComments.length > 0) {
        const userIds = [...new Set(parsedComments.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, avatar_url')
          .in('user_id', userIds);

        if (profiles) {
          const profileMap = new Map();
          profiles.forEach(profile => {
            profileMap.set(profile.user_id, profile);
          });
          setUserProfiles(profileMap);
        }
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const comment: Comment = {
        id: crypto.randomUUID(),
        user_id: user.id,
        comment: newComment.trim(),
        created_at: new Date().toISOString()
      };

      const updatedComments = [...comments, comment];

      // Update invoice with new comments array
      const { error } = await supabase
        .from('invoices')
        .update({ internal_notes: updatedComments as any })
        .eq('id', billId);

      if (error) throw error;

      // Add to audit trail
      await supabase
        .from('invoice_audit_trail')
        .insert({
          invoice_id: billId,
          changed_by: user.id,
          change_type: 'update',
          field_name: 'internal_notes',
          new_value: newComment.trim(),
          reason: 'Added internal note'
        });

      setComments(updatedComments);
      setNewComment("");

      // Load profile for new commenter if not already loaded
      if (!userProfiles.has(user.id)) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, avatar_url')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          setUserProfiles(new Map(userProfiles).set(user.id, profile));
        }
      }

      toast({
        title: "Success",
        description: "Internal note added successfully"
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add internal note",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (profile?: UserProfile) => {
    if (!profile) return '?';
    return `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase();
  };

  const getUserName = (userId: string) => {
    const profile = userProfiles.get(userId);
    if (!profile) return 'Unknown User';
    return `${profile.first_name} ${profile.last_name}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Internal Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Internal Notes ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Comments */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No internal notes yet</p>
            </div>
          ) : (
            comments.map((comment) => {
              const profile = userProfiles.get(comment.user_id);
              return (
                <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url} alt={getUserName(comment.user_id)} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(profile)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{getUserName(comment.user_id)}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{comment.comment}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add New Comment */}
        <div className="space-y-2 pt-4 border-t">
          <Textarea
            placeholder="Add an internal note (for approval, job costing, etc.)..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-20"
          />
          <div className="flex justify-end">
            <Button 
              onClick={handleAddComment}
              disabled={!newComment.trim() || submitting}
              size="sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Add Note
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


import { useEffect, useMemo, useState, type KeyboardEventHandler } from "react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface MentionUser {
  user_id: string;
  display_name: string;
}

interface MentionTextareaProps {
  value: string;
  onValueChange: (value: string) => void;
  companyId?: string | null;
  currentUserId?: string | null;
  placeholder?: string;
  rows?: number;
  id?: string;
  className?: string;
  disabled?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
}

const toHandle = (displayName: string): string =>
  String(displayName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");

export default function MentionTextarea({
  value,
  onValueChange,
  companyId,
  currentUserId,
  placeholder,
  rows,
  id,
  className,
  disabled,
  onKeyDown,
}: MentionTextareaProps) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      if (!companyId) {
        setUsers([]);
        return;
      }
      try {
        setLoadingUsers(true);
        const { data: accessRows, error: accessError } = await supabase
          .from("user_company_access")
          .select("user_id")
          .eq("company_id", companyId)
          .eq("is_active", true);
        if (accessError) throw accessError;

        const userIds = Array.from(
          new Set((accessRows || []).map((row: any) => row.user_id).filter(Boolean))
        );
        if (!userIds.length) {
          setUsers([]);
          return;
        }

        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, display_name, first_name, last_name, status")
          .in("user_id", userIds);
        if (profileError) throw profileError;

        const mapped = (profiles || [])
          .filter((profile: any) => {
            const status = String(profile?.status || "").toLowerCase();
            return status !== "deleted" && status !== "disabled" && status !== "inactive";
          })
          .map((profile: any) => ({
            user_id: profile.user_id,
            display_name:
              profile.display_name ||
              [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
              "User",
          }))
          .filter((profile: MentionUser) => profile.user_id !== currentUserId)
          .sort((a, b) => a.display_name.localeCompare(b.display_name));

        setUsers(mapped);
      } catch (error) {
        console.error("Failed to load mention users", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [companyId, currentUserId]);

  const filteredUsers = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.trim().toLowerCase();
    return users
      .filter((user) => {
        const handle = toHandle(user.display_name);
        return (
          user.display_name.toLowerCase().includes(query) ||
          handle.includes(query)
        );
      })
      .slice(0, 7);
  }, [users, mentionQuery]);

  const handleChange = (nextValue: string) => {
    onValueChange(nextValue);
    const match = nextValue.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/);
    if (!match) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(match[1] || "");
  };

  const insertMention = (user: MentionUser) => {
    const handle = toHandle(user.display_name);
    const nextValue = value.replace(/@([a-zA-Z0-9._-]*)$/, `@${handle} `);
    onValueChange(nextValue);
    setMentionQuery(null);
  };

  return (
    <div className="relative">
      <Textarea
        id={id}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={className}
        disabled={disabled}
        onKeyDown={onKeyDown}
      />
      {mentionQuery !== null && !loadingUsers && filteredUsers.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 z-50 rounded-md border bg-popover shadow-md p-1 max-h-52 overflow-y-auto">
          {filteredUsers.map((user) => (
            <button
              key={user.user_id}
              type="button"
              className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-sm"
              onClick={() => insertMention(user)}
            >
              <span className="font-medium">{user.display_name}</span>
              <span className="text-muted-foreground ml-2">@{toHandle(user.display_name)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

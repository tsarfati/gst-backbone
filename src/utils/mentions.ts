import { supabase } from "@/integrations/supabase/client";

interface MentionCandidate {
  userId: string;
  displayName: string;
  handles: string[];
}

interface NotifyMentionParams {
  companyId: string;
  actorUserId: string;
  actorName: string;
  content: string;
  contextLabel: string;
  targetPath: string;
  jobId?: string | null;
  inAppPreferenceKey?: "chat_mention_notifications" | "task_timeline_mention_notifications";
  emailPreferenceKey?: "mention_email_notifications" | "task_timeline_mention_notifications";
}

const MENTION_REGEX = /@([a-zA-Z0-9._-]+)/g;

const normalizeToken = (value: string): string =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

const buildHandles = (displayName: string): string[] => {
  const tokens = String(displayName || "")
    .toLowerCase()
    .split(/\s+/)
    .map((part) => normalizeToken(part))
    .filter(Boolean);

  const handles = new Set<string>();
  if (tokens.length === 0) return [];

  const full = normalizeToken(tokens.join(""));
  const dotted = normalizeToken(tokens.join("."));
  const underscored = normalizeToken(tokens.join("_"));

  if (full) handles.add(full);
  if (dotted) handles.add(dotted);
  if (underscored) handles.add(underscored);
  tokens.forEach((token) => handles.add(token));

  return Array.from(handles);
};

const extractMentionTokens = (content: string): string[] => {
  const matches = Array.from(String(content || "").matchAll(MENTION_REGEX));
  const tokens = matches
    .map((match) => normalizeToken(match[1]))
    .filter(Boolean);
  return Array.from(new Set(tokens));
};

const fetchMentionCandidates = async (companyId: string, jobId?: string | null): Promise<MentionCandidate[]> => {
  const { data: accessRows, error: accessError } = await supabase
    .from("user_company_access")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (accessError) throw accessError;

  const userIds = Array.from(
    new Set((accessRows || []).map((row: any) => row.user_id).filter(Boolean))
  );

  if (userIds.length === 0) return [];

  let scopedUserIds = userIds;
  if (jobId) {
    const { data: jobAccessRows, error: jobAccessError } = await supabase
      .from("user_job_access")
      .select("user_id")
      .eq("job_id", jobId);
    if (jobAccessError) throw jobAccessError;
    const jobUserIds = new Set((jobAccessRows || []).map((row: any) => row.user_id).filter(Boolean));
    scopedUserIds = userIds.filter((id) => jobUserIds.has(id));
  }

  if (scopedUserIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, display_name, first_name, last_name, status")
    .in("user_id", scopedUserIds);

  if (profileError) throw profileError;

  return (profiles || [])
    .filter((profile: any) => {
      const status = String(profile?.status || "").toLowerCase();
      return status !== "deleted" && status !== "disabled" && status !== "inactive";
    })
    .map((profile: any) => {
      const displayName =
        profile.display_name ||
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        "User";
      return {
        userId: profile.user_id,
        displayName,
        handles: buildHandles(displayName),
      } as MentionCandidate;
    });
};

const resolveMentionedUserIds = (
  mentionTokens: string[],
  candidates: MentionCandidate[],
  actorUserId: string
): string[] => {
  if (mentionTokens.length === 0) return [];

  const mentioned = new Set<string>();
  for (const token of mentionTokens) {
    for (const candidate of candidates) {
      if (candidate.userId === actorUserId) continue;
      if (candidate.handles.includes(token)) {
        mentioned.add(candidate.userId);
      }
    }
  }
  return Array.from(mentioned);
};

const truncate = (text: string, max = 140): string => {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
};

export async function createMentionNotifications(params: NotifyMentionParams): Promise<number> {
  const {
    companyId,
    actorUserId,
    actorName,
    content,
    contextLabel,
    targetPath,
    jobId,
    inAppPreferenceKey,
    emailPreferenceKey,
  } = params;
  const mentionTokens = extractMentionTokens(content);
  if (mentionTokens.length === 0) return 0;

  const candidates = await fetchMentionCandidates(companyId, jobId);
  const mentionedUserIds = resolveMentionedUserIds(mentionTokens, candidates, actorUserId);
  if (mentionedUserIds.length === 0) return 0;

  const { data: settingsRows } = await supabase
    .from("notification_settings")
    .select("user_id, in_app_enabled, chat_mention_notifications, task_timeline_mention_notifications")
    .eq("company_id", companyId)
    .in("user_id", mentionedUserIds);

  const settingsMap = new Map<string, any>(
    ((settingsRows || []) as any[]).map((row) => [String(row.user_id), row]),
  );

  const inAppRecipientIds = mentionedUserIds.filter((userId) => {
    const setting = settingsMap.get(userId);
    if (!setting) return true;
    if (setting.in_app_enabled === false) return false;
    if (inAppPreferenceKey && setting[inAppPreferenceKey] === false) return false;
    return true;
  });

  const notificationRows = inAppRecipientIds.map((userId) => ({
    user_id: userId,
    title: `You were mentioned in ${contextLabel}`,
    message: `${actorName} mentioned you: "${truncate(content)}"`,
    type: `mention:${targetPath}`,
    read: false,
  }));

  if (notificationRows.length > 0) {
    const { error } = await supabase.from("notifications").insert(notificationRows as any);
    if (error) throw error;
  }

  try {
    await supabase.functions.invoke("send-mention-email", {
      body: {
        companyId,
        actorUserId,
        actorName,
        contextLabel,
        targetPath,
        content,
        mentionedUserIds,
        emailPreferenceKey,
      },
    });
  } catch (emailError) {
    console.warn("Failed to send mention email notifications", emailError);
  }

  return notificationRows.length;
}

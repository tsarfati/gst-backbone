import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Briefcase, CalendarDays, Download, ExternalLink, FileText, ImageIcon, MessageSquare, Paperclip, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useVendorPortalData } from "@/hooks/useVendorPortalData";
import { useVendorPortalAccess } from "@/hooks/useVendorPortalAccess";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import RfpPlanPageNoteViewer, { type RfpPlanPageNoteViewerNote } from "@/components/RfpPlanPageNoteViewer";
import PlanPageThumbnail from "@/components/PlanPageThumbnail";
import { resolveStorageUrl } from "@/utils/storageUtils";
import { downloadRfpPlanPagesPdf, downloadSingleRfpPlanPagePdf } from "@/utils/rfpPlanPagesPdf";
import { cn } from "@/lib/utils";

const RESPONSE_LABELS: Record<string, string> = {
  invited: "Invited",
  viewed: "Viewed",
  declined: "Declined",
  submitted: "Bid Submitted",
  pending: "Pending",
};

type RfpAttachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  preview_url?: string | null;
};

type DetailedPlanPage = {
  id: string;
  plan_id: string;
  plan_name: string;
  plan_number: string | null;
  plan_file_url: string | null;
  page_number: number;
  sheet_number: string | null;
  page_title: string | null;
  discipline: string | null;
  thumbnail_url: string | null;
  is_primary: boolean;
  note: string | null;
  callouts: RfpPlanPageNoteViewerNote[];
};

type VendorBidAttachment = {
  id: string;
  file_name: string;
  file_url: string;
  attachment_type: string | null;
  description: string | null;
  uploaded_at?: string | null;
};

type DetailedVendorRfp = {
  invite_id: string;
  company_id: string | null;
  rfp_id: string;
  invited_at: string | null;
  last_viewed_at: string | null;
  response_status: string | null;
  rfp_number: string | null;
  title: string;
  description: string | null;
  scope_of_work: string | null;
  status: string | null;
  issue_date: string | null;
  due_date: string | null;
  job_id: string | null;
  job_name: string | null;
  company_name: string | null;
  attachments: RfpAttachment[];
  plan_pages: DetailedPlanPage[];
  unread_builder_replies: number;
  latest_builder_reply_at: string | null;
  latest_activity_at: string | null;
  latest_activity_sender_name: string | null;
  latest_activity_preview: string | null;
  my_bid: {
    id: string;
    version_number: number;
    bid_amount: number;
    proposed_timeline: string | null;
    notes: string | null;
    status: string;
    submitted_at: string;
    bid_contact_name: string | null;
    bid_contact_email: string | null;
    bid_contact_phone: string | null;
    shipping_included: boolean;
    shipping_amount: number;
    taxes_included: boolean;
    tax_amount: number;
    discount_amount: number;
    attachments: VendorBidAttachment[];
  } | null;
  bid_versions: Array<{
    id: string;
    version_number: number;
    bid_amount: number;
    status: string;
    submitted_at: string;
  }>;
};

type BidFormState = {
  bid_amount: string;
  proposed_timeline: string;
  scope_summary: string;
  clarifications: string;
  exclusions: string;
  notes: string;
  bid_contact_name: string;
  bid_contact_email: string;
  bid_contact_phone: string;
  shipping_included: boolean;
  shipping_amount: string;
  taxes_included: boolean;
  tax_amount: string;
  discount_amount: string;
};

type BidCommunication = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_name: string;
  avatar_url: string | null;
  attachments: VendorBidAttachment[];
};

function parseMessageReference(message: string) {
  const match = message.match(/^\[(Sheet [^\]]+)\]\s*/);
  if (!match) return { reference: null, body: message };
  return {
    reference: match[1],
    body: message.slice(match[0].length),
  };
}

async function resolveOptionalCompanyFileUrl(path: string | null | undefined) {
  if (!path) return null;

  try {
    const resolved = await resolveStorageUrl("company-files", path);
    return resolved || path;
  } catch (error) {
    console.error("VendorPortalRfps: failed resolving company file URL", error);
    return path;
  }
}

async function resolveOptionalAttachmentUrl(path: string | null | undefined) {
  if (!path) return null;

  try {
    const resolved = await resolveStorageUrl("rfp-attachments", path);
    return resolved || path;
  } catch (error) {
    console.error("VendorPortalRfps: failed resolving attachment URL", error);
    return path;
  }
}

function isLikelyImageFile(fileName: string, fileType: string | null | undefined) {
  const normalizedType = String(fileType || "").toLowerCase();
  const normalizedName = fileName.toLowerCase();
  return normalizedType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(normalizedName);
}

function isLikelyPdfFile(fileName: string, fileType: string | null | undefined) {
  const normalizedType = String(fileType || "").toLowerCase();
  const normalizedName = fileName.toLowerCase();
  return normalizedType.includes("pdf") || normalizedName.endsWith(".pdf");
}

function buildCommunicationAttachmentDescription(messageId: string, fileName: string) {
  return `bid_message_attachment:${messageId}:${fileName}`;
}

function pickJoinedRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function extractCommunicationAttachmentMessageId(description: string | null | undefined) {
  const value = String(description || "");
  if (!value.startsWith("bid_message_attachment:")) return null;
  const parts = value.split(":");
  return parts.length >= 3 ? parts[1] : null;
}

const EMPTY_BID_FORM: BidFormState = {
  bid_amount: "",
  proposed_timeline: "",
  scope_summary: "",
  clarifications: "",
  exclusions: "",
  notes: "",
  bid_contact_name: "",
  bid_contact_email: "",
  bid_contact_phone: "",
  shipping_included: true,
  shipping_amount: "0",
  taxes_included: true,
  tax_amount: "0",
  discount_amount: "0",
};

const BID_NOTE_SECTION_LABELS: Record<string, string> = {
  scope_summary: "Scope Summary",
  clarifications: "Clarifications / Assumptions",
  exclusions: "Exclusions",
  notes: "Additional Notes",
};

function parseBidNotes(notes: string | null) {
  const result = {
    scope_summary: "",
    clarifications: "",
    exclusions: "",
    notes: "",
  };

  const raw = String(notes || "").trim();
  if (!raw) return result;

  const sectionPattern = /(Scope Summary|Clarifications \/ Assumptions|Exclusions|Additional Notes):\n([\s\S]*?)(?=\n\n(?:Scope Summary|Clarifications \/ Assumptions|Exclusions|Additional Notes):\n|$)/g;
  let matched = false;
  for (const match of raw.matchAll(sectionPattern)) {
    matched = true;
    const label = match[1];
    const body = match[2]?.trim() || "";
    if (label === "Scope Summary") result.scope_summary = body;
    if (label === "Clarifications / Assumptions") result.clarifications = body;
    if (label === "Exclusions") result.exclusions = body;
    if (label === "Additional Notes") result.notes = body;
  }

  if (!matched) {
    result.notes = raw;
  }

  return result;
}

function buildBidNotes(form: BidFormState) {
  const sections = [
    ["scope_summary", form.scope_summary],
    ["clarifications", form.clarifications],
    ["exclusions", form.exclusions],
    ["notes", form.notes],
  ] as const;

  return sections
    .map(([key, value]) => value.trim() ? `${BID_NOTE_SECTION_LABELS[key]}\n${value.trim()}` : null)
    .filter(Boolean)
    .join("\n\n") || null;
}

function calculateBidSummary(form: BidFormState) {
  const bidAmount = Number(form.bid_amount || 0);
  const discountAmount = Number(form.discount_amount || 0);
  const discountedBase = Math.max(0, bidAmount - discountAmount);
  const shippingAmount = form.shipping_included ? 0 : Number(form.shipping_amount || 0);
  const taxRatePercent = form.taxes_included ? 0 : Number(form.tax_amount || 0);
  const taxAmount = discountedBase * Math.max(0, taxRatePercent) / 100;
  const total = Math.max(0, discountedBase + shippingAmount + taxAmount);

  return {
    bidAmount,
    discountAmount,
    discountedBase,
    shippingAmount,
    taxRatePercent,
    taxAmount,
    total,
  };
}

function AttachmentPreviewTile({ attachment }: { attachment: RfpAttachment }) {
  if (attachment.preview_url && isLikelyImageFile(attachment.file_name, attachment.file_type)) {
    return (
      <img
        src={attachment.preview_url}
        alt={attachment.file_name}
        className="h-16 w-16 rounded-lg border bg-muted object-cover shrink-0"
      />
    );
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
      {isLikelyPdfFile(attachment.file_name, attachment.file_type) ? (
        <FileText className="h-6 w-6" />
      ) : (
        <ImageIcon className="h-6 w-6" />
      )}
    </div>
  );
}

export default function VendorPortalRfps() {
  const navigate = useNavigate();
  const { id: routeRfpId, sheetId: routeSheetId } = useParams<{ id?: string; sheetId?: string }>();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { loading, rfps } = useVendorPortalData();
  const { roleCaps } = useVendorPortalAccess();

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailedRfps, setDetailedRfps] = useState<DetailedVendorRfp[]>([]);
  const [selectedPlanSetId, setSelectedPlanSetId] = useState<string | null>(null);
  const [selectedPlanSetPageId, setSelectedPlanSetPageId] = useState<string | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<RfpAttachment | null>(null);
  const [selectedRfpForBid, setSelectedRfpForBid] = useState<DetailedVendorRfp | null>(null);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidForm, setBidForm] = useState<BidFormState>(EMPTY_BID_FORM);
  const [proposalFiles, setProposalFiles] = useState<File[]>([]);
  const [communications, setCommunications] = useState<BidCommunication[]>([]);
  const [communicationLoading, setCommunicationLoading] = useState(false);
  const [communicationDraft, setCommunicationDraft] = useState("");
  const [communicationFiles, setCommunicationFiles] = useState<File[]>([]);
  const [sendingCommunication, setSendingCommunication] = useState(false);
  const [selectedSheetNoteIndex, setSelectedSheetNoteIndex] = useState<number | null>(null);
  const communicationFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDetails = useCallback(async () => {
    if (!profile?.vendor_id || rfps.length === 0) {
      setDetailedRfps([]);
      return;
    }

    try {
      setDetailsLoading(true);
      const rfpIds = Array.from(new Set(rfps.map((rfp) => rfp.rfp_id).filter(Boolean)));

        let attachmentsByRfp = new Map<string, RfpAttachment[]>();
        if (rfpIds.length > 0) {
          const { data, error } = await supabase
            .from("rfp_attachments")
            .select("id, rfp_id, file_name, file_url, file_type, file_size")
            .in("rfp_id", rfpIds);

          if (error) {
            console.error("VendorPortalRfps: error loading RFP attachments", error);
          } else {
            const resolvedRows = await Promise.all((data || []).map(async (row: any) => ({
              ...row,
              preview_url: await resolveOptionalAttachmentUrl(row.file_url || null),
            })));

            resolvedRows.forEach((row: any) => {
              const key = String(row.rfp_id);
              const list = attachmentsByRfp.get(key) || [];
              list.push({
                id: String(row.id),
                file_name: String(row.file_name || "Attachment"),
                file_url: String(row.file_url || ""),
                file_type: row.file_type || null,
                file_size: row.file_size || null,
                preview_url: row.preview_url || row.file_url || null,
              });
              attachmentsByRfp.set(key, list);
            });
          }
        }

        let planPagesByRfp = new Map<string, DetailedPlanPage[]>();
        const { data: rfpPlanPagesData, error: rfpPlanPagesError } = rfpIds.length > 0
          ? await supabase
              .from("rfp_plan_pages" as any)
              .select(`
                id,
                rfp_id,
                plan_id,
                plan_page_id,
                is_primary,
                note,
                sort_order,
                plan_page:plan_pages!rfp_plan_pages_plan_page_id_fkey(id, page_number, sheet_number, page_title, discipline, thumbnail_url),
                plan:job_plans!rfp_plan_pages_plan_id_fkey(id, plan_name, plan_number, file_url)
              `)
              .in("rfp_id", rfpIds)
              .order("sort_order", { ascending: true })
          : { data: [], error: null };

        if (rfpPlanPagesError) {
          console.error("VendorPortalRfps: error loading RFP plan pages", rfpPlanPagesError);
        } else {
          const rfpPlanPageIds = ((rfpPlanPagesData || []) as any[]).map((row) => String(row.id));
          let calloutsByPlanPageRowId = new Map<string, RfpPlanPageNoteViewerNote[]>();
          if (rfpPlanPageIds.length > 0) {
            const { data: noteRows, error: noteError } = await supabase
              .from("rfp_plan_page_notes" as any)
              .select("id, rfp_plan_page_id, shape_type, x, y, width, height, note_text, sort_order")
              .in("rfp_plan_page_id", rfpPlanPageIds)
              .order("sort_order", { ascending: true });

            if (noteError) {
              console.error("VendorPortalRfps: error loading plan page notes", noteError);
            } else {
              console.info("VendorPortalRfps: loaded plan page notes", {
                rfpIds,
                rfpPlanPageIds,
                noteCount: (noteRows || []).length,
              });
              ((noteRows || []) as any[]).forEach((row) => {
                const key = String(row.rfp_plan_page_id);
                const list = calloutsByPlanPageRowId.get(key) || [];
                list.push({
                  id: String(row.id),
                  shape_type: row.shape_type === "ellipse" ? "ellipse" : "rect",
                  x: Number(row.x || 0),
                  y: Number(row.y || 0),
                  width: Number(row.width || 0),
                  height: Number(row.height || 0),
                  note_text: row.note_text || "",
                });
                calloutsByPlanPageRowId.set(key, list);
              });
            }
          }

          const resolvedPlanPageRows = await Promise.all(((rfpPlanPagesData || []) as any[]).map(async (row) => {
            const key = String(row.rfp_id);
            const resolvedPlanPage = pickJoinedRow<any>(row.plan_page);
            const resolvedPlan = pickJoinedRow<any>(row.plan);
            return {
              rfpKey: key,
              id: String(row.id),
              plan_id: String(resolvedPlan?.id || row.plan_id || ""),
              plan_name: String(resolvedPlan?.plan_name || "Plan Set"),
              plan_number: resolvedPlan?.plan_number || null,
              plan_file_url: resolvedPlan?.file_url || null,
              page_number: Number(resolvedPlanPage?.page_number || 1),
              sheet_number: resolvedPlanPage?.sheet_number || null,
              page_title: resolvedPlanPage?.page_title || null,
              discipline: resolvedPlanPage?.discipline || null,
              thumbnail_url: await resolveOptionalCompanyFileUrl(resolvedPlanPage?.thumbnail_url || null),
              is_primary: !!row.is_primary,
              note: row.note || null,
              callouts: calloutsByPlanPageRowId.get(String(row.id)) || [],
            } satisfies DetailedPlanPage & { rfpKey: string };
          }));

          resolvedPlanPageRows.forEach(({ rfpKey, ...page }) => {
            const list = planPagesByRfp.get(rfpKey) || [];
            list.push(page);
            planPagesByRfp.set(rfpKey, list);
          });

          console.info("VendorPortalRfps: mapped attached plan pages", resolvedPlanPageRows.map((page) => ({
            rfpId: page.rfpKey,
            rfpPlanPageId: page.id,
            sheet: page.sheet_number || `Page ${page.page_number}`,
            noteCount: page.callouts.length,
            hasSheetNote: Boolean(page.note),
          })));
        }

        const { data: myBidsData, error: myBidsError } = rfpIds.length > 0
          ? await supabase
              .from("bids")
              .select(`
                id,
                rfp_id,
                version_number,
                bid_amount,
                proposed_timeline,
                notes,
                status,
                submitted_at,
                bid_contact_name,
                bid_contact_email,
                bid_contact_phone,
                shipping_included,
                shipping_amount,
                taxes_included,
                tax_amount,
                discount_amount
              `)
              .eq("vendor_id", profile.vendor_id)
              .in("rfp_id", rfpIds)
              .order("version_number", { ascending: false })
          : { data: [], error: null };

        let attachmentsByBidId = new Map<string, VendorBidAttachment[]>();
        if (myBidsError) {
          console.error("VendorPortalRfps: error loading existing vendor bids", myBidsError);
        } else {
          const bidIds = ((myBidsData || []) as any[]).map((row) => String(row.id));
          if (bidIds.length > 0) {
            const { data: bidAttachmentRows, error: bidAttachmentError } = await supabase
              .from("bid_attachments")
              .select("id, bid_id, file_name, file_url, attachment_type, description")
              .in("bid_id", bidIds)
              .order("uploaded_at", { ascending: false });

            if (bidAttachmentError) {
              console.error("VendorPortalRfps: error loading bid attachments", bidAttachmentError);
            } else {
              (bidAttachmentRows || []).forEach((row: any) => {
                const key = String(row.bid_id);
                const list = attachmentsByBidId.get(key) || [];
                list.push({
                  id: String(row.id),
                  file_name: String(row.file_name || "Attachment"),
                  file_url: String(row.file_url || ""),
                  attachment_type: row.attachment_type || null,
                  description: row.description || null,
                });
                attachmentsByBidId.set(key, list);
              });
            }
          }
        }

        const bidByRfp = new Map<string, DetailedVendorRfp["my_bid"]>();
        const bidVersionsByRfp = new Map<string, DetailedVendorRfp["bid_versions"]>();
        ((myBidsData || []) as any[]).forEach((row) => {
          const rfpKey = String(row.rfp_id);
          const versionEntry = {
            id: String(row.id),
            version_number: Number(row.version_number || 1),
            bid_amount: Number(row.bid_amount || 0),
            status: String(row.status || "submitted"),
            submitted_at: String(row.submitted_at || new Date().toISOString()),
          };
          const versionList = bidVersionsByRfp.get(rfpKey) || [];
          versionList.push(versionEntry);
          bidVersionsByRfp.set(rfpKey, versionList);

          if (!bidByRfp.has(rfpKey)) {
            bidByRfp.set(rfpKey, {
              id: String(row.id),
              version_number: Number(row.version_number || 1),
              bid_amount: Number(row.bid_amount || 0),
              proposed_timeline: row.proposed_timeline || null,
              notes: row.notes || null,
              status: String(row.status || "submitted"),
              submitted_at: String(row.submitted_at || new Date().toISOString()),
              bid_contact_name: row.bid_contact_name || null,
              bid_contact_email: row.bid_contact_email || null,
              bid_contact_phone: row.bid_contact_phone || null,
              shipping_included: !!row.shipping_included,
              shipping_amount: Number(row.shipping_amount || 0),
              taxes_included: !!row.taxes_included,
              tax_amount: Number(row.tax_amount || 0),
              discount_amount: Number(row.discount_amount || 0),
              attachments: attachmentsByBidId.get(String(row.id)) || [],
            });
          }
        });

        const bidIds = ((myBidsData || []) as any[]).map((row) => String(row.id)).filter(Boolean);
        const communicationRowsByBidId = new Map<string, any[]>();
        const communicationUserIds = new Set<string>();
        if (bidIds.length > 0) {
          const { data: commRows, error: commError } = await supabase
            .from("bid_communications" as any)
            .select("bid_id, user_id, message, created_at")
            .in("bid_id", bidIds)
            .eq("message_type", "vendor")
            .order("created_at", { ascending: false });
          if (commError) {
            console.error("VendorPortalRfps: error loading communication summaries", commError);
          } else {
            ((commRows || []) as any[]).forEach((row) => {
              const bidId = String(row.bid_id || "");
              if (!bidId) return;
              const current = communicationRowsByBidId.get(bidId) || [];
              current.push(row);
              communicationRowsByBidId.set(bidId, current);
              if (row.user_id) {
                communicationUserIds.add(String(row.user_id));
              }
            });
          }
        }

        const communicationProfileMap = new Map<string, string>();
        if (communicationUserIds.size > 0) {
          const { data: communicationProfiles, error: communicationProfilesError } = await supabase
            .from("profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", Array.from(communicationUserIds));

          if (communicationProfilesError) {
            console.error("VendorPortalRfps: error loading communication summary profiles", communicationProfilesError);
          } else {
            ((communicationProfiles || []) as any[]).forEach((row) => {
              communicationProfileMap.set(
                String(row.user_id),
                [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "BuilderLYNK User",
              );
            });
          }
        }

        const communicationSummaryByBidId = new Map<
          string,
          { unread: number; latest: string | null; latestSenderName: string | null; latestPreview: string | null }
        >();
        communicationRowsByBidId.forEach((rows, bidId) => {
          const latestRow = rows[0] || null;
          const current = {
            unread: 0,
            latest: latestRow?.created_at ? String(latestRow.created_at) : null,
            latestSenderName: latestRow?.user_id ? communicationProfileMap.get(String(latestRow.user_id)) || "BuilderLYNK User" : null,
            latestPreview: latestRow?.message ? String(latestRow.message) : null,
          };

          const rfpForBid = rfps.find((rfp) => {
            const bid = bidByRfp.get(rfp.rfp_id);
            return bid?.id === bidId;
          });
          const lastViewedAtMs = rfpForBid?.last_viewed_at ? new Date(rfpForBid.last_viewed_at).getTime() : 0;

          rows.forEach((row) => {
            const isBuilderReply = String(row.user_id || "") !== String(user?.id || "");
            const createdAtMs = row.created_at ? new Date(String(row.created_at)).getTime() : 0;
            if (isBuilderReply && createdAtMs > lastViewedAtMs) {
              current.unread += 1;
            }
          });

          communicationSummaryByBidId.set(bidId, current);
        });

      setDetailedRfps(
        rfps.map((rfp) => ({
          invite_id: rfp.id,
          company_id: rfp.company_id,
          rfp_id: rfp.rfp_id,
          invited_at: rfp.invited_at,
          last_viewed_at: rfp.last_viewed_at,
          response_status: rfp.response_status,
          rfp_number: rfp.rfp_number,
          title: rfp.title,
          description: rfp.description,
          scope_of_work: rfp.scope_of_work,
          status: rfp.status,
          issue_date: rfp.issue_date,
          due_date: rfp.due_date,
          job_id: rfp.job_id,
          job_name: rfp.job_name,
          company_name: rfp.company_name,
          attachments: attachmentsByRfp.get(rfp.rfp_id) || [],
          plan_pages: planPagesByRfp.get(rfp.rfp_id) || [],
          unread_builder_replies: (() => {
            const bid = bidByRfp.get(rfp.rfp_id);
            const summary = bid ? communicationSummaryByBidId.get(bid.id) : null;
            return summary?.unread || 0;
          })(),
          latest_builder_reply_at: (() => {
            const bid = bidByRfp.get(rfp.rfp_id);
            const summary = bid ? communicationSummaryByBidId.get(bid.id) : null;
            return summary?.latest || null;
          })(),
          latest_activity_at: (() => {
            const bid = bidByRfp.get(rfp.rfp_id);
            const summary = bid ? communicationSummaryByBidId.get(bid.id) : null;
            return summary?.latest || null;
          })(),
          latest_activity_sender_name: (() => {
            const bid = bidByRfp.get(rfp.rfp_id);
            const summary = bid ? communicationSummaryByBidId.get(bid.id) : null;
            return summary?.latestSenderName || null;
          })(),
          latest_activity_preview: (() => {
            const bid = bidByRfp.get(rfp.rfp_id);
            const summary = bid ? communicationSummaryByBidId.get(bid.id) : null;
            return summary?.latestPreview || null;
          })(),
          my_bid: bidByRfp.get(rfp.rfp_id) || null,
          bid_versions: bidVersionsByRfp.get(rfp.rfp_id) || [],
        })),
      );
    } finally {
      setDetailsLoading(false);
    }
  }, [profile?.vendor_id, rfps, user?.id]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    setSelectedSheetNoteIndex(null);
  }, [routeSheetId]);

  useEffect(() => {
    setSelectedSheetNoteIndex(null);
  }, [selectedPlanSetPageId]);

  const openRfps = useMemo(
    () => detailedRfps.filter((rfp) => {
      const status = String(rfp.status || "").toLowerCase();
      return status !== "closed" && status !== "awarded" && status !== "cancelled";
    }),
    [detailedRfps],
  );

  const respondedRfpCount = useMemo(
    () => detailedRfps.filter((rfp) => ["submitted", "declined"].includes(String(rfp.response_status || "").toLowerCase())).length,
    [detailedRfps],
  );
  const selectedDetailRfp = useMemo(
    () => (routeRfpId ? detailedRfps.find((rfp) => rfp.rfp_id === routeRfpId) || null : null),
    [detailedRfps, routeRfpId],
  );
  const selectedSheetFromRoute = useMemo(
    () => (routeSheetId && selectedDetailRfp ? selectedDetailRfp.plan_pages.find((page) => page.id === routeSheetId) || null : null),
    [routeSheetId, selectedDetailRfp],
  );
  const selectedSheetIndex = useMemo(
    () => (selectedSheetFromRoute && selectedDetailRfp ? selectedDetailRfp.plan_pages.findIndex((page) => page.id === selectedSheetFromRoute.id) : -1),
    [selectedSheetFromRoute, selectedDetailRfp],
  );
  const previousSheetFromRoute = useMemo(
    () => (selectedSheetIndex > 0 && selectedDetailRfp ? selectedDetailRfp.plan_pages[selectedSheetIndex - 1] : null),
    [selectedSheetIndex, selectedDetailRfp],
  );
  const nextSheetFromRoute = useMemo(
    () => (
      selectedSheetIndex >= 0 &&
      selectedDetailRfp &&
      selectedSheetIndex < selectedDetailRfp.plan_pages.length - 1
        ? selectedDetailRfp.plan_pages[selectedSheetIndex + 1]
        : null
    ),
    [selectedSheetIndex, selectedDetailRfp],
  );
  const latestCommunication = useMemo(
    () => communications[0] || null,
    [communications],
  );
  const visibleRfps = useMemo(
    () => (routeRfpId ? (selectedDetailRfp ? [selectedDetailRfp] : []) : detailedRfps),
    [routeRfpId, selectedDetailRfp, detailedRfps],
  );
  const bidSummary = useMemo(() => calculateBidSummary(bidForm), [bidForm]);
  const selectedDetailBidSummary = useMemo(
    () =>
      selectedDetailRfp?.my_bid
        ? calculateBidSummary({
            ...EMPTY_BID_FORM,
            bid_amount: String(selectedDetailRfp.my_bid.bid_amount || 0),
            proposed_timeline: selectedDetailRfp.my_bid.proposed_timeline || "",
            bid_contact_name: selectedDetailRfp.my_bid.bid_contact_name || "",
            bid_contact_email: selectedDetailRfp.my_bid.bid_contact_email || "",
            bid_contact_phone: selectedDetailRfp.my_bid.bid_contact_phone || "",
            shipping_included: selectedDetailRfp.my_bid.shipping_included,
            shipping_amount: String(selectedDetailRfp.my_bid.shipping_amount || 0),
            taxes_included: selectedDetailRfp.my_bid.taxes_included,
            tax_amount: String(selectedDetailRfp.my_bid.tax_amount || 0),
            discount_amount: String(selectedDetailRfp.my_bid.discount_amount || 0),
            ...parseBidNotes(selectedDetailRfp.my_bid.notes || null),
          })
        : null,
    [selectedDetailRfp],
  );
  const selectedDetailPlanSets = useMemo(() => {
    if (!selectedDetailRfp) return [];

    const grouped = new Map<string, {
      id: string;
      plan_id: string;
      plan_name: string;
      plan_number: string | null;
      plan_file_url: string | null;
      pages: DetailedPlanPage[];
      noteCount: number;
    }>();

    selectedDetailRfp.plan_pages.forEach((page) => {
      const key = page.plan_id || page.id;
      const existing = grouped.get(key);
      if (existing) {
        existing.pages.push(page);
        existing.noteCount += page.callouts.length;
        return;
      }
      grouped.set(key, {
        id: key,
        plan_id: page.plan_id,
        plan_name: page.plan_name,
        plan_number: page.plan_number,
        plan_file_url: page.plan_file_url,
        pages: [page],
        noteCount: page.callouts.length,
      });
    });

    return Array.from(grouped.values()).map((set) => ({
      ...set,
      pages: [...set.pages].sort((a, b) => a.page_number - b.page_number),
    }));
  }, [selectedDetailRfp]);
  const selectedPlanSet = useMemo(
    () => selectedDetailPlanSets.find((set) => set.id === selectedPlanSetId) || null,
    [selectedDetailPlanSets, selectedPlanSetId],
  );
  const selectedPlanSetPage = useMemo(
    () => selectedPlanSet?.pages.find((page) => page.id === selectedPlanSetPageId) || selectedPlanSet?.pages[0] || null,
    [selectedPlanSet, selectedPlanSetPageId],
  );

  const openBidDialog = (rfp: DetailedVendorRfp) => {
    const noteSections = parseBidNotes(rfp.my_bid?.notes || null);
    setSelectedRfpForBid(rfp);
    setProposalFiles([]);
    setBidForm({
      bid_amount: rfp.my_bid?.bid_amount ? String(rfp.my_bid.bid_amount) : "",
      proposed_timeline: rfp.my_bid?.proposed_timeline || "",
      scope_summary: noteSections.scope_summary,
      clarifications: noteSections.clarifications,
      exclusions: noteSections.exclusions,
      notes: noteSections.notes,
      bid_contact_name: rfp.my_bid?.bid_contact_name || "",
      bid_contact_email: rfp.my_bid?.bid_contact_email || user?.email || "",
      bid_contact_phone: rfp.my_bid?.bid_contact_phone || "",
      shipping_included: rfp.my_bid?.shipping_included ?? true,
      shipping_amount: String(rfp.my_bid?.shipping_amount ?? 0),
      taxes_included: rfp.my_bid?.taxes_included ?? true,
      tax_amount: String(rfp.my_bid?.tax_amount ?? 0),
      discount_amount: String(rfp.my_bid?.discount_amount ?? 0),
    });
    setBidDialogOpen(true);
  };

  const openPlanSetPreview = (planSetId: string, pageId?: string | null) => {
    const targetSet = selectedDetailPlanSets.find((set) => set.id === planSetId);
    if (!targetSet) return;
    setSelectedPlanSetId(planSetId);
    setSelectedPlanSetPageId(pageId || targetSet.pages[0]?.id || null);
  };

  const openStoredFile = async (bucket: string, pathOrUrl: string) => {
    const resolvedUrl = await resolveStorageUrl(bucket as any, pathOrUrl);
    window.open(resolvedUrl, "_blank", "noopener,noreferrer");
  };

  const ensureBidRecord = useCallback(async (rfp: DetailedVendorRfp) => {
    if (!profile?.vendor_id || !rfp.company_id) {
      throw new Error("Missing vendor or company context for this RFP.");
    }

    if (rfp.my_bid?.id) {
      return rfp.my_bid.id;
    }

    const { data, error } = await supabase
      .from("bids")
      .insert({
        rfp_id: rfp.rfp_id,
        vendor_id: profile.vendor_id,
        company_id: rfp.company_id,
        bid_amount: 0,
        status: "draft",
      } as any)
      .select("id")
      .single();

    if (error) throw error;
    return String(data.id);
  }, [profile?.vendor_id]);

  const loadCommunications = useCallback(async () => {
    if (!selectedDetailRfp?.my_bid?.id) {
      setCommunications([]);
      return;
    }

    try {
      setCommunicationLoading(true);
      const { data, error } = await supabase
        .from("bid_communications" as any)
        .select("id, user_id, message, created_at")
        .eq("bid_id", selectedDetailRfp.my_bid.id)
        .eq("message_type", "vendor")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const userIds = Array.from(new Set(((data || []) as any[]).map((row) => String(row.user_id)).filter(Boolean)));
      const profileMap = new Map<string, { user_name: string; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, avatar_url")
          .in("user_id", userIds);

        if (profileError) {
          console.error("VendorPortalRfps: failed loading communication profiles", profileError);
        } else {
          ((profileRows || []) as any[]).forEach((row) => {
            profileMap.set(String(row.user_id), {
              user_name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "BuilderLYNK User",
              avatar_url: row.avatar_url || null,
            });
          });
        }
      }

      const { data: attachmentRows, error: attachmentError } = await supabase
        .from("bid_attachments")
        .select("id, bid_id, file_name, file_url, attachment_type, description, uploaded_at")
        .eq("bid_id", selectedDetailRfp.my_bid.id)
        .eq("attachment_type", "vendor_message")
        .order("uploaded_at", { ascending: true });

      if (attachmentError) {
        console.error("VendorPortalRfps: failed loading communication attachments", attachmentError);
      }

      const attachmentsByMessageId = new Map<string, VendorBidAttachment[]>();
      (attachmentRows || []).forEach((row: any) => {
        const messageId = extractCommunicationAttachmentMessageId(row.description);
        if (!messageId) return;
        const current = attachmentsByMessageId.get(messageId) || [];
        current.push({
          id: String(row.id),
          file_name: String(row.file_name || "Attachment"),
          file_url: String(row.file_url || ""),
          attachment_type: row.attachment_type || null,
          description: row.description || null,
          uploaded_at: row.uploaded_at || null,
        });
        attachmentsByMessageId.set(messageId, current);
      });

      setCommunications(
        ((data || []) as any[]).map((row) => ({
          id: String(row.id),
          user_id: String(row.user_id),
          message: String(row.message || ""),
          created_at: String(row.created_at),
          user_name: profileMap.get(String(row.user_id))?.user_name || "BuilderLYNK User",
          avatar_url: profileMap.get(String(row.user_id))?.avatar_url || null,
          attachments: attachmentsByMessageId.get(String(row.id)) || [],
        })),
      );
    } catch (error) {
      console.error("VendorPortalRfps: failed loading communications", error);
      setCommunications([]);
    } finally {
      setCommunicationLoading(false);
    }
  }, [selectedDetailRfp?.my_bid?.id]);

  useEffect(() => {
    void loadCommunications();
  }, [loadCommunications]);

  useEffect(() => {
    const markViewed = async () => {
      if (!routeRfpId || !selectedDetailRfp?.invite_id) return;

      const normalizedStatus = String(selectedDetailRfp.response_status || "").toLowerCase();
      const shouldMarkViewed =
        !selectedDetailRfp.last_viewed_at ||
        selectedDetailRfp.unread_builder_replies > 0 ||
        normalizedStatus === "invited" ||
        normalizedStatus === "pending";

      if (!shouldMarkViewed) return;

      const nextResponseStatus = normalizedStatus === "invited" || normalizedStatus === "pending"
        ? "viewed"
        : selectedDetailRfp.response_status;

      const { error } = await supabase
        .from("rfp_invited_vendors")
        .update({
          last_viewed_at: new Date().toISOString(),
          response_status: nextResponseStatus,
        })
        .eq("id", selectedDetailRfp.invite_id);

      if (error) {
        console.error("VendorPortalRfps: failed marking invite as viewed", error);
        return;
      }

      await loadDetails();
    };

    void markViewed();
  }, [
    routeRfpId,
    selectedDetailRfp?.invite_id,
    selectedDetailRfp?.last_viewed_at,
    selectedDetailRfp?.response_status,
    selectedDetailRfp?.unread_builder_replies,
    loadDetails,
  ]);

  const submitVendorBid = async () => {
    if (!selectedRfpForBid || !profile?.vendor_id || !selectedRfpForBid.company_id) return;

    const amount = Number(bidForm.bid_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: "Invalid bid amount",
        description: "Enter a valid bid amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmittingBid(true);
      const notes = buildBidNotes(bidForm);
      let bidId = selectedRfpForBid.my_bid?.id || null;

      if (bidId) {
        const { error } = await supabase
          .from("bids")
          .update({
            bid_amount: amount,
            proposed_timeline: bidForm.proposed_timeline.trim() || null,
            notes,
            status: "submitted",
            bid_contact_name: bidForm.bid_contact_name.trim() || null,
            bid_contact_email: bidForm.bid_contact_email.trim() || null,
            bid_contact_phone: bidForm.bid_contact_phone.trim() || null,
            shipping_included: bidForm.shipping_included,
            shipping_amount: bidForm.shipping_included ? 0 : Number(bidForm.shipping_amount || 0),
            taxes_included: bidForm.taxes_included,
            tax_amount: bidForm.taxes_included ? 0 : Number(bidForm.tax_amount || 0),
            discount_amount: Number(bidForm.discount_amount || 0),
          } as any)
          .eq("id", bidId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("bids")
          .insert({
            rfp_id: selectedRfpForBid.rfp_id,
            vendor_id: profile.vendor_id,
            company_id: selectedRfpForBid.company_id,
            bid_amount: amount,
            proposed_timeline: bidForm.proposed_timeline.trim() || null,
            notes,
            status: "submitted",
            bid_contact_name: bidForm.bid_contact_name.trim() || null,
            bid_contact_email: bidForm.bid_contact_email.trim() || null,
            bid_contact_phone: bidForm.bid_contact_phone.trim() || null,
            shipping_included: bidForm.shipping_included,
            shipping_amount: bidForm.shipping_included ? 0 : Number(bidForm.shipping_amount || 0),
            taxes_included: bidForm.taxes_included,
            tax_amount: bidForm.taxes_included ? 0 : Number(bidForm.tax_amount || 0),
            discount_amount: Number(bidForm.discount_amount || 0),
          } as any)
          .select("id")
          .single();

        if (error) throw error;
        bidId = String(data.id);
      }

      for (const file of proposalFiles) {
        const storagePath = `${selectedRfpForBid.company_id}/${bidId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("bid-attachments")
          .upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("bid-attachments")
          .getPublicUrl(storagePath);

        const { error: attachmentError } = await supabase
          .from("bid_attachments")
          .insert({
            bid_id: bidId,
            company_id: selectedRfpForBid.company_id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            file_url: publicUrlData.publicUrl,
            uploaded_by: user?.id || "",
            attachment_type: "proposal",
            description: "Vendor proposal attachment",
          } as any);

        if (attachmentError) throw attachmentError;
      }

      const { error: inviteUpdateError } = await supabase
        .from("rfp_invited_vendors")
        .update({
          response_status: "submitted",
          last_viewed_at: new Date().toISOString(),
        })
        .eq("id", selectedRfpForBid.invite_id);
      if (inviteUpdateError) {
        console.warn("VendorPortalRfps: unable to update invite response status", inviteUpdateError);
      }

      toast({
        title: selectedRfpForBid.my_bid ? "Bid updated" : "Bid submitted",
        description: "Your proposal has been saved and shared with the builder.",
      });

      setBidDialogOpen(false);
      setSelectedRfpForBid(null);
      setProposalFiles([]);
      setBidForm(EMPTY_BID_FORM);
      await loadDetails();
      await loadCommunications();
    } catch (error: any) {
      console.error("VendorPortalRfps: failed to submit bid", error);
      toast({
        title: "Bid submission failed",
        description: error?.message || "Unable to submit bid at this time.",
        variant: "destructive",
      });
    } finally {
      setSubmittingBid(false);
    }
  };

  const sendCommunication = async () => {
    if (!selectedDetailRfp || !user?.id) return;
    const message = communicationDraft.trim();
    if (!message) return;

    try {
      setSendingCommunication(true);
      const bidId = await ensureBidRecord(selectedDetailRfp);
      const { data: insertedMessage, error } = await supabase
        .from("bid_communications" as any)
        .insert({
          bid_id: bidId,
          company_id: selectedDetailRfp.company_id,
          vendor_id: profile?.vendor_id,
          user_id: user.id,
          message_type: "vendor",
          message,
        })
        .select("id")
        .single();

      if (error) throw error;
      const messageId = String(insertedMessage.id);

      for (const file of communicationFiles) {
        const storagePath = `${selectedDetailRfp.company_id}/${bidId}/messages/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("bid-attachments")
          .upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("bid-attachments")
          .getPublicUrl(storagePath);

        const { error: attachmentInsertError } = await supabase
          .from("bid_attachments")
          .insert({
            bid_id: bidId,
            company_id: selectedDetailRfp.company_id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            file_url: publicUrlData.publicUrl,
            uploaded_by: user.id,
            attachment_type: "vendor_message",
            description: buildCommunicationAttachmentDescription(messageId, file.name),
          } as any);

        if (attachmentInsertError) throw attachmentInsertError;
      }

      setCommunicationDraft("");
      setCommunicationFiles([]);
      await loadDetails();
      await loadCommunications();
      toast({
        title: "Message sent",
        description: "Your note was added to the RFP conversation.",
      });
    } catch (error: any) {
      console.error("VendorPortalRfps: failed sending communication", error);
      toast({
        title: "Message failed",
        description: error?.message || "Unable to send this message right now.",
        variant: "destructive",
      });
    } finally {
      setSendingCommunication(false);
    }
  };

  const queuePlanReferenceMessage = (rfp: DetailedVendorRfp, page: DetailedPlanPage, noteNumber?: number) => {
    const reference = `Sheet ${page.sheet_number || `Page ${page.page_number}`}${noteNumber ? ` • Note ${noteNumber}` : ""}`;
    const pieces = [
      `[${reference}]`,
      `Question on ${page.sheet_number || `Page ${page.page_number}`}`,
      page.page_title ? `(${page.page_title})` : "",
      `for ${rfp.rfp_number || rfp.title}:`,
      noteNumber ? `Please clarify note ${noteNumber}.` : "Please clarify this sheet and any relevant details for bidding.",
    ].filter(Boolean);

    const draft = pieces.join(" ");
    if (routeRfpId) {
      setCommunicationDraft(draft);
      return;
    }

    navigate(`/vendor/rfps/${rfp.rfp_id}`);
    setTimeout(() => {
      setCommunicationDraft(draft);
    }, 50);
  };

  if (loading || detailsLoading) {
    return <PremiumLoadingScreen text="Loading RFP invitations..." />;
  }

  if (!roleCaps.canViewRfps && detailedRfps.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            RFP access is not enabled for your vendor role yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (routeRfpId && selectedDetailRfp && routeSheetId && selectedSheetFromRoute) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-1">
          <Button variant="ghost" className="px-0" onClick={() => navigate(`/vendor/rfps/${selectedDetailRfp.rfp_id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to RFP
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{selectedSheetFromRoute.sheet_number || `Page ${selectedSheetFromRoute.page_number}`}</h1>
          <p className="text-sm text-muted-foreground">
            {selectedDetailRfp.rfp_number || "RFP"} • {selectedDetailRfp.title}
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="h-[82vh]">
                <RfpPlanPageNoteViewer
                  planId={selectedSheetFromRoute.plan_id}
                  fileUrl={selectedSheetFromRoute.plan_file_url}
                  pageNumber={selectedSheetFromRoute.page_number}
                  sheetNumber={selectedSheetFromRoute.sheet_number}
                  pageTitle={selectedSheetFromRoute.page_title}
                  planName={selectedSheetFromRoute.plan_name}
                  planNumber={selectedSheetFromRoute.plan_number}
                  sheetNote={selectedSheetFromRoute.note}
                  notes={selectedSheetFromRoute.callouts}
                  selectedNoteIndex={selectedSheetNoteIndex}
                  onSelectNote={setSelectedSheetNoteIndex}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-primary/15 bg-gradient-to-br from-background via-background to-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sheet Context</CardTitle>
                <CardDescription>
                  Reference this sheet directly in your conversation and bid clarifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-background/90 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sheet Position</p>
                      <p className="mt-1 text-sm font-semibold">
                        {selectedSheetIndex + 1} of {selectedDetailRfp.plan_pages.length}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {selectedSheetFromRoute.sheet_number || `Page ${selectedSheetFromRoute.page_number}`}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!previousSheetFromRoute}
                      onClick={() => previousSheetFromRoute && navigate(`/vendor/rfps/${selectedDetailRfp.rfp_id}/sheets/${previousSheetFromRoute.id}`)}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!nextSheetFromRoute}
                      onClick={() => nextSheetFromRoute && navigate(`/vendor/rfps/${selectedDetailRfp.rfp_id}/sheets/${nextSheetFromRoute.id}`)}
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{selectedSheetFromRoute.sheet_number || `Page ${selectedSheetFromRoute.page_number}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSheetFromRoute.plan_name}
                    {selectedSheetFromRoute.plan_number ? ` #${selectedSheetFromRoute.plan_number}` : ""}
                    {selectedSheetFromRoute.page_title ? ` • ${selectedSheetFromRoute.page_title}` : ""}
                  </p>
                  {selectedSheetFromRoute.note ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedSheetFromRoute.note}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      queuePlanReferenceMessage(selectedDetailRfp, selectedSheetFromRoute);
                      navigate(`/vendor/rfps/${selectedDetailRfp.rfp_id}`);
                    }}
                  >
                    Ask About This Sheet
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/plans/${selectedSheetFromRoute.plan_id}`)}
                  >
                    Open Full Plan Viewer
                  </Button>
                </div>
              </CardContent>
            </Card>

            {selectedSheetFromRoute.callouts.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Linked Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedSheetFromRoute.callouts.map((callout, index) => (
                    <div
                      key={callout.id}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        selectedSheetNoteIndex === index ? "border-amber-400 bg-amber-50/70" : "bg-background",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <Badge variant="outline">Note {index + 1}</Badge>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {callout.note_text?.trim() || "No note text was entered for this callout."}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedSheetNoteIndex(index)}
                          >
                            View Note
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              queuePlanReferenceMessage(selectedDetailRfp, selectedSheetFromRoute, index + 1);
                              navigate(`/vendor/rfps/${selectedDetailRfp.rfp_id}`);
                            }}
                          >
                            Ask About Note
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (routeRfpId && selectedDetailRfp) {
    const responseKey = String(selectedDetailRfp.response_status || "invited").toLowerCase();
    const responseLabel = RESPONSE_LABELS[responseKey] || selectedDetailRfp.response_status || "Invited";

    return (
      <div className="p-6 space-y-6">
        <div className="space-y-1">
          <Button variant="ghost" className="px-0" onClick={() => navigate("/vendor/rfps")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to All RFPs
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{selectedDetailRfp.title}</h1>
                {selectedDetailRfp.rfp_number ? <Badge variant="outline">{selectedDetailRfp.rfp_number}</Badge> : null}
                <Badge variant={responseKey === "submitted" ? "default" : "secondary"}>{responseLabel}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {selectedDetailRfp.company_name ? <span>{selectedDetailRfp.company_name}</span> : null}
                {selectedDetailRfp.job_name ? <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{selectedDetailRfp.job_name}</span> : null}
                {selectedDetailRfp.due_date ? <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Due {new Date(selectedDetailRfp.due_date).toLocaleDateString()}</span> : null}
              </div>
              {selectedDetailRfp.scope_of_work ? (
                <p className="max-w-5xl text-sm text-muted-foreground whitespace-pre-wrap">{selectedDetailRfp.scope_of_work}</p>
              ) : selectedDetailRfp.description ? (
                <p className="max-w-5xl text-sm text-muted-foreground whitespace-pre-wrap">{selectedDetailRfp.description}</p>
              ) : null}
            </div>
            <Button onClick={() => openBidDialog(selectedDetailRfp)}>
              <FileText className="mr-2 h-4 w-4" />
              {selectedDetailRfp.my_bid ? "Update Bid" : "Submit Bid"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Plan Sets</h2>
              </div>
              <div className="overflow-hidden rounded-xl border bg-background/50">
                {selectedDetailPlanSets.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-muted-foreground">No plan pages attached to this RFP yet.</div>
                ) : (
                  selectedDetailPlanSets.map((planSet) => {
                    const previewPage = planSet.pages[0];
                    const pageCount = planSet.pages.length;
                    return (
                    <button
                      key={planSet.id}
                      type="button"
                      onClick={() => openPlanSetPreview(planSet.id)}
                      className="w-full border-b border-transparent bg-transparent px-4 py-3 text-left transition-colors hover:border-primary/70 hover:bg-primary/5 hover:ring-1 hover:ring-primary/20 last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <PlanPageThumbnail
                            thumbnailUrl={previewPage?.thumbnail_url}
                            planFileUrl={previewPage?.plan_file_url}
                            pageNumber={previewPage?.page_number || 1}
                            alt={previewPage?.sheet_number || `Page ${previewPage?.page_number || 1}`}
                          />
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">
                                {planSet.plan_name}
                                {planSet.plan_number ? ` #${planSet.plan_number}` : ""}
                              </p>
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                {pageCount} page{pageCount === 1 ? "" : "s"}
                              </Badge>
                              {planSet.noteCount > 0 ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{planSet.noteCount} note{planSet.noteCount === 1 ? "" : "s"}</Badge> : null}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {pageCount === 1
                                ? `${previewPage?.sheet_number || `Page ${previewPage?.page_number || 1}`}${previewPage?.page_title ? ` • ${previewPage.page_title}` : ""}`
                                : `${pageCount} shared sheet${pageCount === 1 ? "" : "s"} from this set`}
                            </p>
                            {pageCount === 1 && previewPage?.note ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{previewPage.note}</p> : null}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (pageCount === 1 && previewPage?.plan_file_url) {
                                void downloadSingleRfpPlanPagePdf({
                                  page: {
                                    plan_id: previewPage.plan_id,
                                    plan_name: previewPage.plan_name,
                                    plan_file_url: previewPage.plan_file_url,
                                    page_number: previewPage.page_number,
                                    sheet_number: previewPage.sheet_number,
                                    page_title: previewPage.page_title,
                                  },
                                  fileName: `${selectedDetailRfp.rfp_number || "RFP"}_${previewPage.sheet_number || `Page-${previewPage.page_number}`}.pdf`,
                                });
                              } else {
                                void downloadRfpPlanPagesPdf({
                                  fileName: `${selectedDetailRfp.rfp_number || "RFP"}_${planSet.plan_name.replace(/[^\w.-]+/g, "_")}.pdf`,
                                  pages: planSet.pages.map((page) => ({
                                    plan_id: page.plan_id,
                                    plan_name: page.plan_name,
                                    plan_file_url: page.plan_file_url,
                                    page_number: page.page_number,
                                    sheet_number: page.sheet_number,
                                    page_title: page.page_title,
                                  })),
                                });
                              }
                            }}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </button>
                  )})
                )}
              </div>
            </section>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>RFP Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedDetailRfp.attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents attached to this RFP.</p>
                ) : (
                  selectedDetailRfp.attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() => setSelectedAttachment(attachment)}
                      className="flex w-full items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-3 text-left transition-colors hover:border-primary/70 hover:bg-primary/5 hover:ring-1 hover:ring-primary/20"
                    >
                      <div className="flex min-w-0 gap-3">
                        <AttachmentPreviewTile attachment={attachment} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.file_size ? `${Math.max(1, Math.round(attachment.file_size / 1024))} KB` : "Document"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void openStoredFile("rfp-attachments", attachment.file_url);
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Builder Communication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {communicationLoading ? (
                    <p className="text-sm text-muted-foreground">Loading conversation...</p>
                  ) : communications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No messages yet. Start the conversation here.</p>
                  ) : (
                    communications.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 rounded-md border bg-background px-3 py-3">
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt={entry.user_name} className="h-9 w-9 rounded-full border object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-xs font-medium text-muted-foreground">
                            {entry.user_name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          {(() => {
                            const parsed = parseMessageReference(entry.message);
                            return (
                              <>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium">{entry.user_name}</p>
                                  <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p>
                                </div>
                                {parsed.reference ? <Badge variant="outline" className="mt-2">{parsed.reference}</Badge> : null}
                                <p className="mt-1 whitespace-pre-wrap text-sm">{parsed.body}</p>
                                {entry.attachments.length > 0 ? (
                                  <div className="mt-3 space-y-2">
                                    {entry.attachments.map((attachment) => (
                                      <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                                          <p className="text-xs text-muted-foreground">Attachment</p>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => window.open(attachment.file_url, "_blank", "noopener,noreferrer")}
                                        >
                                          <Download className="mr-2 h-4 w-4" />
                                          Open
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-2">
                  <div className="rounded-lg border border-border bg-background transition-colors focus-within:border-primary/80 focus-within:ring-1 focus-within:ring-primary/20">
                    <div className="relative">
                      <Textarea
                        enableSpeech={false}
                        className="min-h-[96px] resize-none border-0 bg-transparent pb-12 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        value={communicationDraft}
                        onChange={(e) => setCommunicationDraft(e.target.value)}
                        placeholder="Ask a question about the plans, scope, pricing assumptions, or schedule..."
                      />
                      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => communicationFileInputRef.current?.click()}
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <Button onClick={sendCommunication} disabled={sendingCommunication || !communicationDraft.trim()}>
                          {sendingCommunication ? "Sending..." : "Send Message"}
                        </Button>
                      </div>
                    </div>
                    <Input
                      ref={communicationFileInputRef}
                      type="file"
                      multiple
                      onChange={(event) => {
                        const nextFiles = Array.from(event.target.files || []);
                        if (nextFiles.length > 0) {
                          setCommunicationFiles((prev) => [...prev, ...nextFiles]);
                        }
                        event.target.value = "";
                      }}
                      className="hidden"
                    />
                    {communicationFiles.length > 0 ? (
                      <div className="space-y-2 border-t px-3 py-3">
                        {communicationFiles.map((file, index) => (
                          <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCommunicationFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
        </div>

        <Dialog
          open={Boolean(selectedPlanSet && selectedPlanSetPage)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedPlanSetId(null);
              setSelectedPlanSetPageId(null);
            }
          }}
        >
          <DialogContent className="max-w-[92vw] w-[1600px] h-[92vh] p-0">
            {selectedPlanSet && selectedPlanSetPage ? (
              <>
                <DialogTitle className="sr-only">
                  {selectedPlanSetPage.sheet_number || `Page ${selectedPlanSetPage.page_number}`}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Preview the attached plan sheet for this RFP.
                </DialogDescription>
                <RfpPlanPageNoteViewer
                  planId={selectedPlanSetPage.plan_id}
                  fileUrl={selectedPlanSetPage.plan_file_url}
                  pageNumber={selectedPlanSetPage.page_number}
                  sheetNumber={selectedPlanSetPage.sheet_number}
                  pageTitle={selectedPlanSetPage.page_title}
                  planName={selectedPlanSetPage.plan_name}
                  planNumber={selectedPlanSetPage.plan_number}
                  thumbnailUrl={selectedPlanSetPage.thumbnail_url}
                  sheetNote={selectedPlanSetPage.note}
                  notes={selectedPlanSetPage.callouts}
                  selectedNoteIndex={selectedSheetNoteIndex}
                  onSelectNote={setSelectedSheetNoteIndex}
                  pageOptions={selectedPlanSet.pages.map((page) => ({
                    id: page.id,
                    label: `${page.sheet_number || `Page ${page.page_number}`}${page.page_title ? ` • ${page.page_title}` : ""}`,
                  }))}
                  selectedPageId={selectedPlanSetPage.id}
                  onSelectPage={setSelectedPlanSetPageId}
                  onClose={() => {
                    setSelectedPlanSetId(null);
                    setSelectedPlanSetPageId(null);
                  }}
                  onDownload={() => void downloadSingleRfpPlanPagePdf({
                    page: {
                      plan_id: selectedPlanSetPage.plan_id,
                      plan_name: selectedPlanSetPage.plan_name,
                      plan_file_url: selectedPlanSetPage.plan_file_url,
                      page_number: selectedPlanSetPage.page_number,
                      sheet_number: selectedPlanSetPage.sheet_number,
                      page_title: selectedPlanSetPage.page_title,
                    },
                    fileName: `${selectedDetailRfp.rfp_number || "RFP"}_${selectedPlanSetPage.sheet_number || `Page-${selectedPlanSetPage.page_number}`}.pdf`,
                  })}
                />
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(selectedAttachment)}
          onOpenChange={(open) => {
            if (!open) setSelectedAttachment(null);
          }}
        >
          <DialogContent className="max-w-[92vw] w-[1400px] h-[88vh] p-0 overflow-hidden">
            {selectedAttachment ? (
              <>
                <DialogTitle className="sr-only">{selectedAttachment.file_name}</DialogTitle>
                <DialogDescription className="sr-only">
                  Preview the attached RFP file.
                </DialogDescription>
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{selectedAttachment.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedAttachment.file_size ? `${Math.max(1, Math.round(selectedAttachment.file_size / 1024))} KB` : "Document preview"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void openStoredFile("rfp-attachments", selectedAttachment.file_url)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                      <Button type="button" variant="outline" size="icon" onClick={() => setSelectedAttachment(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 bg-muted/20 p-4">
                    {selectedAttachment.preview_url && isLikelyImageFile(selectedAttachment.file_name, selectedAttachment.file_type) ? (
                      <div className="flex h-full items-center justify-center overflow-auto">
                        <img
                          src={selectedAttachment.preview_url}
                          alt={selectedAttachment.file_name}
                          className="max-h-full max-w-full rounded border bg-background object-contain shadow-sm"
                        />
                      </div>
                    ) : selectedAttachment.preview_url && isLikelyPdfFile(selectedAttachment.file_name, selectedAttachment.file_type) ? (
                      <iframe
                        src={selectedAttachment.preview_url}
                        title={selectedAttachment.file_name}
                        className="h-full w-full rounded border bg-background"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                        <FileText className="h-10 w-10" />
                        <div>
                          <p className="font-medium text-foreground">Preview not available for this file type.</p>
                          <p className="text-sm">Use download to open it in the best available application.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
          <DialogContent className="max-w-[96vw] w-[1320px] max-h-[92vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>{selectedRfpForBid?.my_bid ? "Update Bid" : "Submit Bid"}</DialogTitle>
              <DialogDescription>
                {selectedRfpForBid ? `${selectedRfpForBid.rfp_number || "RFP"} - ${selectedRfpForBid.title}` : "Provide your bid details."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="max-h-[calc(92vh-11rem)] overflow-y-auto pr-2">
                <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bid Amount *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bidForm.bid_amount}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, bid_amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Proposed Timeline</Label>
                  <Input
                    value={bidForm.proposed_timeline}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, proposed_timeline: e.target.value }))}
                    placeholder="e.g. 4 weeks from award"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Scope of Work Summary</Label>
                  <Textarea
                    enableSpeech={false}
                    className="min-h-[96px]"
                    value={bidForm.scope_summary}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, scope_summary: e.target.value }))}
                    placeholder="Summarize exactly what your proposal includes."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bid Contact Name</Label>
                  <Input
                    value={bidForm.bid_contact_name}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, bid_contact_name: e.target.value }))}
                    placeholder="Primary estimator or PM"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bid Contact Email</Label>
                  <Input
                    type="email"
                    value={bidForm.bid_contact_email}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, bid_contact_email: e.target.value }))}
                    placeholder="contact@vendor.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bid Contact Phone</Label>
                  <Input
                    value={bidForm.bid_contact_phone}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, bid_contact_phone: e.target.value }))}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bidForm.discount_amount}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, discount_amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shipping / Delivery Cost</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={bidForm.shipping_included}
                    value={bidForm.shipping_amount}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, shipping_amount: e.target.value }))}
                    placeholder="0.00"
                  />
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={bidForm.shipping_included}
                      onChange={(e) => setBidForm((prev) => ({ ...prev, shipping_included: e.target.checked }))}
                    />
                    Shipping included in bid amount
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Tax Rate %</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={bidForm.taxes_included}
                    value={bidForm.tax_amount}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, tax_amount: e.target.value }))}
                    placeholder="0.00"
                  />
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={bidForm.taxes_included}
                      onChange={(e) => setBidForm((prev) => ({ ...prev, taxes_included: e.target.checked }))}
                    />
                    Taxes included in bid amount
                  </label>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 md:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">Proposal Summary</p>
                    <Badge variant="outline">Calculated</Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Base bid</span>
                      <span>${bidSummary.bidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span>-${bidSummary.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Net before shipping/tax</span>
                      <span>${bidSummary.discountedBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>{bidForm.shipping_included ? "Included" : `$${bidSummary.shippingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{bidForm.taxes_included ? "Included" : `${bidSummary.taxRatePercent.toLocaleString(undefined, { maximumFractionDigits: 2 })}% / $${bidSummary.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm font-semibold">
                      <span>Total proposed amount</span>
                      <span>${bidSummary.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Clarifications / Assumptions</Label>
                  <Textarea
                    enableSpeech={false}
                    className="min-h-[90px]"
                    value={bidForm.clarifications}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, clarifications: e.target.value }))}
                    placeholder="List assumptions, inclusions, alternates, or clarifications."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Exclusions</Label>
                  <Textarea
                    enableSpeech={false}
                    className="min-h-[90px]"
                    value={bidForm.exclusions}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, exclusions: e.target.value }))}
                    placeholder="Call out anything excluded from this bid."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Additional Notes</Label>
                  <Textarea
                    enableSpeech={false}
                    className="min-h-[100px]"
                    value={bidForm.notes}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Anything else the builder should know before award."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Proposal / Quote Attachments</Label>
                  <div className="rounded-lg border border-dashed p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium">Upload your formal proposal, quote, scope sheet, or supporting files.</p>
                        <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, images, and other common proposal files are accepted.</p>
                      </div>
                      <Input
                        type="file"
                        multiple
                        onChange={(event) => {
                          const nextFiles = Array.from(event.target.files || []);
                          if (nextFiles.length > 0) {
                            setProposalFiles((prev) => [...prev, ...nextFiles]);
                          }
                          event.target.value = "";
                        }}
                        className="max-w-xs"
                      />
                    </div>
                    {proposalFiles.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {proposalFiles.map((file, index) => (
                          <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setProposalFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                </div>
              </div>
              <div className="space-y-4 xl:sticky xl:top-0">
                <Card className="border-primary/15 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Bid Snapshot</CardTitle>
                    <CardDescription>
                      Live summary while you prepare the proposal.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-lg border bg-background/80 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Total</p>
                      <p className="mt-1 text-2xl font-bold">
                        ${bidSummary.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="space-y-2 rounded-lg border bg-background/80 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Base bid</span>
                        <span>${bidSummary.bidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Discount</span>
                        <span>-${bidSummary.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Shipping</span>
                        <span>{bidForm.shipping_included ? "Included" : `$${bidSummary.shippingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tax</span>
                        <span>{bidForm.taxes_included ? "Included" : `${bidSummary.taxRatePercent.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background/80 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attachments</p>
                      <p className="mt-1 text-sm font-semibold">
                        {proposalFiles.length} file{proposalFiles.length === 1 ? "" : "s"} ready
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background/80 p-3 text-muted-foreground">
                      <p className="text-xs font-medium uppercase tracking-wide">Submission Notes</p>
                      <ul className="mt-2 space-y-2 text-sm">
                        <li>Keep scope summary aligned with the attached quote.</li>
                        <li>Use clarifications for assumptions and alternates.</li>
                        <li>Use exclusions for anything not covered by the number above.</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setBidDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitVendorBid} disabled={submittingBid}>
                {submittingBid ? "Saving..." : selectedRfpForBid?.my_bid ? "Update Bid" : "Submit Bid"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" className="px-0" onClick={() => navigate("/vendor/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        {routeRfpId ? (
          <Button variant="ghost" className="px-0 ml-4" onClick={() => navigate("/vendor/rfps")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to All RFPs
          </Button>
        ) : null}
        <h1 className="text-2xl font-bold text-foreground">{routeRfpId ? "RFP" : "RFPs"}</h1>
        <p className="text-sm text-muted-foreground">
          {routeRfpId
            ? "Review this RFP, open attached plan pages, and submit or update your bid."
            : "Review bid invitations, open attached plan pages, and submit full proposal responses."}
        </p>
      </div>

      <Card>
        {!routeRfpId ? (
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>RFPs</CardTitle>
                <CardDescription>
                  View by list
                </CardDescription>
              </div>
              <div className="hidden items-center gap-6 text-xs font-medium uppercase tracking-wide text-muted-foreground md:flex">
                <span className="min-w-[120px] text-right">Due Date</span>
                <span className="min-w-[92px] text-right">Action</span>
              </div>
            </div>
          </CardHeader>
        ) : null}
        <CardContent className="space-y-4">
          {visibleRfps.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              {routeRfpId ? "That vendor RFP could not be found." : "No RFP invitations are visible for this vendor account yet."}
            </div>
          ) : (
            visibleRfps.map((rfp) => {
              const responseKey = String(rfp.response_status || "invited").toLowerCase();
              const responseLabel = RESPONSE_LABELS[responseKey] || rfp.response_status || "Invited";
              const summaryText = rfp.description || rfp.scope_of_work;

              if (!routeRfpId) {
                return (
                  <button
                    key={rfp.invite_id}
                    type="button"
                    onClick={() => navigate(`/vendor/rfps/${rfp.rfp_id}`)}
                    className="w-full rounded-xl border bg-background p-4 text-left transition-colors hover:bg-muted/10"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-foreground">{rfp.title}</h2>
                          {rfp.rfp_number ? <Badge variant="outline">{rfp.rfp_number}</Badge> : null}
                          <Badge variant={responseKey === "submitted" ? "default" : "secondary"}>{responseLabel}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          {rfp.company_name ? <span>{rfp.company_name}</span> : null}
                          {rfp.job_name ? <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{rfp.job_name}</span> : null}
                        </div>
                        {summaryText ? (
                          <p className="max-w-4xl text-sm text-muted-foreground whitespace-pre-wrap">{summaryText}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
                        <div className="text-sm text-muted-foreground md:text-right">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Due Date</p>
                          <p className="mt-1 font-medium text-foreground">
                            {rfp.due_date ? new Date(rfp.due_date).toLocaleDateString() : "No due date"}
                          </p>
                        </div>
                        <Button variant="outline">
                          Open RFP
                        </Button>
                      </div>
                    </div>
                  </button>
                );
              }

              return (
                <div key={rfp.invite_id} className="rounded-xl border p-4 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-foreground">{rfp.title}</h2>
                        {rfp.rfp_number ? <Badge variant="outline">{rfp.rfp_number}</Badge> : null}
                        <Badge variant={responseKey === "submitted" ? "default" : "secondary"}>{responseLabel}</Badge>
                        {rfp.unread_builder_replies > 0 ? (
                          <Badge>{rfp.unread_builder_replies} new repl{rfp.unread_builder_replies === 1 ? "y" : "ies"}</Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        {rfp.company_name ? <span>{rfp.company_name}</span> : null}
                        {rfp.job_name ? <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{rfp.job_name}</span> : null}
                        {rfp.due_date ? <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Due {new Date(rfp.due_date).toLocaleDateString()}</span> : null}
                      </div>
                      {rfp.latest_activity_at ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">Latest activity</span>
                          <span>{rfp.latest_activity_sender_name || "BuilderLYNK User"}</span>
                          <span>{new Date(rfp.latest_activity_at).toLocaleString()}</span>
                          {rfp.latest_activity_preview ? (
                            <span className="max-w-[32rem] truncate">• {parseMessageReference(rfp.latest_activity_preview).body}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {rfp.scope_of_work ? (
                        <p className="max-w-4xl text-sm text-muted-foreground whitespace-pre-wrap">{rfp.scope_of_work}</p>
                      ) : rfp.description ? (
                        <p className="max-w-4xl text-sm text-muted-foreground whitespace-pre-wrap">{rfp.description}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {rfp.job_id ? (
                        <Button variant="outline" onClick={() => navigate(`/vendor/jobs/${rfp.job_id}`)}>
                          View Job
                        </Button>
                      ) : null}
                      {!routeRfpId ? (
                        <Button variant="outline" onClick={() => navigate(`/vendor/rfps/${rfp.rfp_id}`)}>
                          Open RFP
                        </Button>
                      ) : null}
                      <Button onClick={() => openBidDialog(rfp)}>
                        <FileText className="mr-2 h-4 w-4" />
                        {rfp.my_bid ? "Update Bid" : "Submit Bid"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
                    <div className="space-y-3">
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">Attachments</p>
                          <Badge variant="outline">{rfp.attachments.length}</Badge>
                        </div>
                        {rfp.attachments.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No documents attached to this RFP.</p>
                        ) : (
                          <div className="space-y-2">
                            {rfp.attachments.map((attachment) => (
                              <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {attachment.file_size ? `${Math.max(1, Math.round(attachment.file_size / 1024))} KB` : "Document"}
                                  </p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => void openStoredFile("rfp-attachments", attachment.file_url)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {rfp.my_bid ? (
                        <div className="rounded-lg border bg-emerald-500/5 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">
                                Current bid: ${Number(rfp.my_bid.bid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Submitted {new Date(rfp.my_bid.submitted_at).toLocaleString()}
                              </p>
                            </div>
                            <Badge>{rfp.my_bid.status}</Badge>
                          </div>
                          {rfp.my_bid.attachments.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proposal Attachments</p>
                              {rfp.my_bid.attachments.map((attachment) => (
                                <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                                    {attachment.description ? <p className="text-xs text-muted-foreground">{attachment.description}</p> : null}
                                  </div>
                                  <Button size="sm" variant="outline" onClick={() => window.open(attachment.file_url, "_blank", "noopener,noreferrer")}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {rfp.bid_versions.length > 1 ? (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bid Version History</p>
                              {rfp.bid_versions.map((version) => (
                                <div key={version.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                                  <div>
                                    <p className="font-medium">Version {version.version_number}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(version.submitted_at).toLocaleString()}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium">${version.bid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <p className="text-xs text-muted-foreground">{version.status}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                      <div className="rounded-lg border bg-muted/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Attached Plan Pages</p>
                            <p className="text-xs text-muted-foreground">Click a sheet to open the attached plan preview.</p>
                          </div>
                          <Badge variant="outline">{rfp.plan_pages.length}</Badge>
                        </div>
                      {rfp.plan_pages.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No plan pages attached to this RFP yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {rfp.plan_pages.map((page) => (
                            <button
                              key={page.id}
                              type="button"
                              onClick={() => setSelectedPlanPage(page)}
                              className="w-full rounded-md border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex min-w-0 gap-3">
                                  {page.thumbnail_url ? (
                                    <img
                                      src={page.thumbnail_url}
                                      alt={page.sheet_number || `Page ${page.page_number}`}
                                      className="h-16 w-12 rounded border object-cover shrink-0 bg-muted"
                                    />
                                  ) : (
                                    <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded border bg-muted text-[10px] text-muted-foreground">
                                      Pg {page.page_number}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium">{page.sheet_number || `Page ${page.page_number}`}</p>
                                      {page.is_primary ? <Badge className="h-5 px-1.5 text-[10px]">Primary</Badge> : null}
                                      {page.callouts.length > 0 ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{page.callouts.length} note{page.callouts.length === 1 ? "" : "s"}</Badge> : null}
                                    </div>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {page.plan_name}
                                      {page.plan_number ? ` #${page.plan_number}` : ""}
                                      {page.page_title ? ` • ${page.page_title}` : ""}
                                    </p>
                                    {page.note ? <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{page.note}</p> : null}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {routeRfpId ? (
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                      <div>
                        <p className="text-sm font-medium">Builder Communication</p>
                        <p className="text-xs text-muted-foreground">
                          Use this thread for scope questions, plan clarifications, alternates, and schedule notes tied to this RFP.
                        </p>
                      </div>
                      <div className="space-y-3">
                        {communicationLoading ? (
                          <p className="text-sm text-muted-foreground">Loading conversation...</p>
                        ) : communications.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No messages yet. Start the conversation here.</p>
                        ) : (
                          communications.map((entry) => (
                            <div key={entry.id} className="flex items-start gap-3 rounded-md border bg-background px-3 py-3">
                              {entry.avatar_url ? (
                                <img src={entry.avatar_url} alt={entry.user_name} className="h-9 w-9 rounded-full border object-cover" />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-xs font-medium text-muted-foreground">
                                  {entry.user_name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                {(() => {
                                  const parsed = parseMessageReference(entry.message);
                                  return (
                                    <>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium">{entry.user_name}</p>
                                  <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p>
                                </div>
                                      {parsed.reference ? <Badge variant="outline" className="mt-2">{parsed.reference}</Badge> : null}
                                      <p className="mt-1 whitespace-pre-wrap text-sm">{parsed.body}</p>
                                      {entry.attachments.length > 0 ? (
                                        <div className="mt-3 space-y-2">
                                          {entry.attachments.map((attachment) => (
                                            <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                                              <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                                                <p className="text-xs text-muted-foreground">Attachment</p>
                                              </div>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => window.open(attachment.file_url, "_blank", "noopener,noreferrer")}
                                              >
                                                <Download className="mr-2 h-4 w-4" />
                                                Open
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="space-y-2">
                        <Textarea
                          enableSpeech={false}
                          className="min-h-[110px] resize-none"
                          value={communicationDraft}
                          onChange={(e) => setCommunicationDraft(e.target.value)}
                          placeholder="Ask a question about the plans, scope, pricing assumptions, or schedule..."
                        />
                        <div className="rounded-lg border border-dashed p-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => communicationFileInputRef.current?.click()}
                            >
                              <Paperclip className="h-4 w-4" />
                            </Button>
                            <Input
                              ref={communicationFileInputRef}
                              type="file"
                              multiple
                              onChange={(event) => {
                                const nextFiles = Array.from(event.target.files || []);
                                if (nextFiles.length > 0) {
                                  setCommunicationFiles((prev) => [...prev, ...nextFiles]);
                                }
                                event.target.value = "";
                              }}
                              className="hidden"
                            />
                          </div>
                          {communicationFiles.length > 0 ? (
                            <div className="space-y-2">
                              {communicationFiles.map((file, index) => (
                                <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCommunicationFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex justify-end">
                          <Button onClick={sendCommunication} disabled={sendingCommunication || !communicationDraft.trim()}>
                            {sendingCommunication ? "Sending..." : "Send Message"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
      </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedPlanSet && selectedPlanSetPage)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPlanSetId(null);
            setSelectedPlanSetPageId(null);
          }
        }}
      >
        <DialogContent className="max-w-[92vw] w-[1600px] h-[92vh] p-0">
          {selectedPlanSet && selectedPlanSetPage ? (
            <>
              <DialogTitle className="sr-only">
                {selectedPlanSetPage.sheet_number || `Page ${selectedPlanSetPage.page_number}`}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Preview the attached plan sheet for this RFP.
              </DialogDescription>
              <RfpPlanPageNoteViewer
                planId={selectedPlanSetPage.plan_id}
                fileUrl={selectedPlanSetPage.plan_file_url}
                pageNumber={selectedPlanSetPage.page_number}
                sheetNumber={selectedPlanSetPage.sheet_number}
                pageTitle={selectedPlanSetPage.page_title}
                planName={selectedPlanSetPage.plan_name}
                planNumber={selectedPlanSetPage.plan_number}
                thumbnailUrl={selectedPlanSetPage.thumbnail_url}
                sheetNote={selectedPlanSetPage.note}
                notes={selectedPlanSetPage.callouts}
                selectedNoteIndex={selectedSheetNoteIndex}
                onSelectNote={setSelectedSheetNoteIndex}
                pageOptions={selectedPlanSet.pages.map((page) => ({
                  id: page.id,
                  label: `${page.sheet_number || `Page ${page.page_number}`}${page.page_title ? ` • ${page.page_title}` : ""}`,
                }))}
                selectedPageId={selectedPlanSetPage.id}
                onSelectPage={setSelectedPlanSetPageId}
                onClose={() => {
                  setSelectedPlanSetId(null);
                  setSelectedPlanSetPageId(null);
                }}
                onDownload={() => void downloadSingleRfpPlanPagePdf({
                  page: {
                    plan_id: selectedPlanSetPage.plan_id,
                    plan_name: selectedPlanSetPage.plan_name,
                    plan_file_url: selectedPlanSetPage.plan_file_url,
                    page_number: selectedPlanSetPage.page_number,
                    sheet_number: selectedPlanSetPage.sheet_number,
                    page_title: selectedPlanSetPage.page_title,
                  },
                  fileName: `${selectedRfpForBid?.rfp_number || "RFP"}_${selectedPlanSetPage.sheet_number || `Page-${selectedPlanSetPage.page_number}`}.pdf`,
                })}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
        <DialogContent className="max-w-[92vw] w-[1180px] max-h-[92vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedRfpForBid?.my_bid ? "Update Bid" : "Submit Bid"}</DialogTitle>
            <DialogDescription>
              {selectedRfpForBid ? `${selectedRfpForBid.rfp_number || "RFP"} - ${selectedRfpForBid.title}` : "Provide your bid details."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(92vh-11rem)] overflow-y-auto pr-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Bid Amount *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bidForm.bid_amount}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, bid_amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Proposed Timeline</Label>
                <Input
                  value={bidForm.proposed_timeline}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, proposed_timeline: e.target.value }))}
                  placeholder="e.g. 4 weeks from award"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Scope of Work Summary</Label>
                <Textarea
                  enableSpeech={false}
                  className="min-h-[96px]"
                  value={bidForm.scope_summary}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, scope_summary: e.target.value }))}
                  placeholder="Summarize exactly what your proposal includes."
                />
              </div>
              <div className="space-y-2">
                <Label>Bid Contact Name</Label>
                <Input
                  value={bidForm.bid_contact_name}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, bid_contact_name: e.target.value }))}
                  placeholder="Primary estimator or PM"
                />
              </div>
              <div className="space-y-2">
                <Label>Bid Contact Email</Label>
                <Input
                  type="email"
                  value={bidForm.bid_contact_email}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, bid_contact_email: e.target.value }))}
                  placeholder="contact@vendor.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Bid Contact Phone</Label>
                <Input
                  value={bidForm.bid_contact_phone}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, bid_contact_phone: e.target.value }))}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Discount Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bidForm.discount_amount}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, discount_amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Shipping / Delivery Cost</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={bidForm.shipping_included}
                  value={bidForm.shipping_amount}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, shipping_amount: e.target.value }))}
                  placeholder="0.00"
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={bidForm.shipping_included}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, shipping_included: e.target.checked }))}
                  />
                  Shipping included in bid amount
                </label>
              </div>
              <div className="space-y-2">
                <Label>Tax Rate %</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={bidForm.taxes_included}
                  value={bidForm.tax_amount}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, tax_amount: e.target.value }))}
                  placeholder="0.00"
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={bidForm.taxes_included}
                    onChange={(e) => setBidForm((prev) => ({ ...prev, taxes_included: e.target.checked }))}
                  />
                  Taxes included in bid amount
                </label>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3 md:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">Proposal Summary</p>
                  <Badge variant="outline">Calculated</Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Base bid</span>
                  <span>${bidSummary.bidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-${bidSummary.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Net before shipping/tax</span>
                  <span>${bidSummary.discountedBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{bidForm.shipping_included ? "Included" : `$${bidSummary.shippingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{bidForm.taxes_included ? "Included" : `${bidSummary.taxRatePercent.toLocaleString(undefined, { maximumFractionDigits: 2 })}% / $${bidSummary.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm font-semibold">
                  <span>Total proposed amount</span>
                  <span>${bidSummary.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Clarifications / Assumptions</Label>
                <Textarea
                  enableSpeech={false}
                  className="min-h-[90px]"
                  value={bidForm.clarifications}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, clarifications: e.target.value }))}
                  placeholder="List assumptions, inclusions, alternates, or clarifications."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Exclusions</Label>
                <Textarea
                  enableSpeech={false}
                  className="min-h-[90px]"
                  value={bidForm.exclusions}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, exclusions: e.target.value }))}
                  placeholder="Call out anything excluded from this bid."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Additional Notes</Label>
                <Textarea
                  enableSpeech={false}
                  className="min-h-[100px]"
                  value={bidForm.notes}
                  onChange={(e) => setBidForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Anything else the builder should know before award."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Proposal / Quote Attachments</Label>
                <div className="rounded-lg border border-dashed p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium">Upload your formal proposal, quote, scope sheet, or supporting files.</p>
                      <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, images, and other common proposal files are accepted.</p>
                    </div>
                    <Input
                      type="file"
                      multiple
                      onChange={(event) => {
                        const nextFiles = Array.from(event.target.files || []);
                        if (nextFiles.length > 0) {
                          setProposalFiles((prev) => [...prev, ...nextFiles]);
                        }
                        event.target.value = "";
                      }}
                      className="max-w-xs"
                    />
                  </div>
                  {proposalFiles.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {proposalFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setProposalFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBidDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitVendorBid} disabled={submittingBid}>
              {submittingBid ? "Saving..." : selectedRfpForBid?.my_bid ? "Update Bid" : "Submit Bid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AskPlanAiResponse = {
  answer: string;
  confidence: "high" | "medium" | "low";
  citations: Array<{
    source: string;
    reason: string;
    target_page_number?: number | null;
    target_sheet_number?: string | null;
  }>;
  needsClarification?: boolean;
  clarifyingQuestion?: string | null;
  traceId?: string | null;
};

type LinkOnPage = {
  ref_text: string | null;
  target_page_number: number | null;
  target_sheet_number: string | null;
  target_title: string | null;
  confidence: number | null;
  x_norm?: number | null;
  y_norm?: number | null;
  w_norm?: number | null;
  h_norm?: number | null;
};

type IndexedPage = {
  page_number: number | null;
  sheet_number: string | null;
  page_title: string | null;
  discipline: string | null;
};

type SelectionRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type VisualCountResult = {
  object_name: string;
  count_on_page: number;
  confidence: "high" | "medium" | "low";
  rationale: string;
  matches?: Array<{ x: number; y: number }>;
};

type VisualSelectionQaResult = {
  answer: string;
  selected_label: string;
  source_reference: string;
  confidence: "high" | "medium" | "low";
  rationale: string;
};

const normalizeRef = (value: string | null | undefined) =>
  String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/([A-Z])[-_](\d)/g, "$1$2")
    .trim();

const textContainsKnownReference = (source: string, knownRefs: Set<string>) => {
  const normalized = normalizeRef(source);
  if (!normalized) return false;
  for (const ref of knownRefs) {
    if (!ref) continue;
    if (normalized.includes(ref) || ref.includes(normalized)) return true;
  }
  return false;
};

const extractJsonObject = (raw: string): string => {
  const trimmed = raw.trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
};

const dedupeCitations = (citations: AskPlanAiResponse["citations"]) => {
  const seen = new Set<string>();
  const out: AskPlanAiResponse["citations"] = [];
  for (const c of citations) {
    const key = `${normalizeRef(c.source)}|${c.target_page_number ?? ""}|${normalizeRef(c.target_sheet_number || "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
};

const extractPageFromText = (text: string): number | null => {
  const pageMatch = String(text || "").match(/\bP(?:AGE)?\s*(\d{1,4})\b/i);
  if (!pageMatch?.[1]) return null;
  const n = Number(pageMatch[1]);
  return Number.isFinite(n) ? n : null;
};

const extractSheetFromText = (text: string): string | null => {
  const match = String(text || "").match(/\b([A-Z]{1,4}\s*[-.]?\s*\d{1,3}(?:\.\d{1,3})?)\b/i);
  return match?.[1] || null;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const normalizeSelectionRect = (value: any): SelectionRect | null => {
  if (!value || typeof value !== "object") return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const w = Number(value.w);
  const h = Number(value.h);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  if (w <= 0 || h <= 0) return null;
  return {
    x: clamp01(x),
    y: clamp01(y),
    w: clamp01(w),
    h: clamp01(h),
  };
};

const overlaps = (a: SelectionRect, b: SelectionRect) =>
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y;

const isCountQuestion = (question: string) =>
  /\b(how many|count|number of|qty|quantity)\b/i.test(question);

const isSelectionVisionQuestion = (question: string) =>
  /\b(what is this|what does this|note|callout|symbol|tag|detail|wall|assembly|spec|specification|reference)\b/i.test(question);

const parseVisualCountJson = (raw: string): VisualCountResult | null => {
  try {
    const parsed = JSON.parse(extractJsonObject(raw));
    const objectName = String(parsed?.object_name || "").trim();
    const count = Number(parsed?.count_on_page);
    const confidence =
      parsed?.confidence === "high" || parsed?.confidence === "medium" || parsed?.confidence === "low"
        ? parsed.confidence
        : "low";
    const rationale = String(parsed?.rationale || "").trim();
    const matches = Array.isArray(parsed?.matches)
      ? parsed.matches
          .map((m: any) => ({ x: Number(m?.x), y: Number(m?.y) }))
          .filter((m: any) => Number.isFinite(m.x) && Number.isFinite(m.y))
          .map((m: any) => ({ x: clamp01(m.x), y: clamp01(m.y) }))
      : [];
    if (!objectName || !Number.isFinite(count) || count < 0) return null;

    const dedupedMatches: Array<{ x: number; y: number }> = [];
    const minDist = 0.01;
    for (const m of matches) {
      const exists = dedupedMatches.some((d) => Math.hypot(d.x - m.x, d.y - m.y) < minDist);
      if (!exists) dedupedMatches.push(m);
    }
    const finalCount = dedupedMatches.length > 0 ? dedupedMatches.length : Math.round(count);

    return {
      object_name: objectName,
      count_on_page: finalCount,
      confidence,
      rationale: rationale || "Visual count based on selected sample and current sheet.",
      matches: dedupedMatches,
    };
  } catch {
    return null;
  }
};

const runVisualCountPass = async (params: {
  lovableApiKey: string;
  question: string;
  sampleBase64: string;
  pageBase64: string;
  strictMode: boolean;
}): Promise<VisualCountResult | null> => {
  const { lovableApiKey, question, sampleBase64, pageBase64, strictMode } = params;
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0.0,
      messages: [
        {
          role: "system",
          content: strictMode
            ? "You are verifying a construction drawing symbol count. Be conservative. Exclude legends, title blocks, schedules, and symbol examples that are not installed plan instances. Return strict JSON: {\"object_name\": string, \"count_on_page\": number, \"confidence\": \"high|medium|low\", \"rationale\": string, \"matches\": [{\"x\": number, \"y\": number}]}. matches are normalized page coordinates 0-1."
            : "You are counting symbols on construction drawings. The first image is a selected example symbol/area. The second image is the full sheet page. Identify the selected item type and count visually similar installed instances on the full page. Return strict JSON: {\"object_name\": string, \"count_on_page\": number, \"confidence\": \"high|medium|low\", \"rationale\": string, \"matches\": [{\"x\": number, \"y\": number}]}. matches are normalized page coordinates 0-1.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Question: ${question}` },
            { type: "text", text: "Image 1 = selected area sample. Image 2 = full page for counting." },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${sampleBase64}` },
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${pageBase64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) return null;
  const body = await response.json();
  const raw = String(body?.choices?.[0]?.message?.content || "");
  return parseVisualCountJson(raw);
};

const parseVisualSelectionQaJson = (raw: string): VisualSelectionQaResult | null => {
  try {
    const parsed = JSON.parse(extractJsonObject(raw));
    const answer = String(parsed?.answer || "").trim();
    const selectedLabel = String(parsed?.selected_label || "").trim();
    const sourceReference = String(parsed?.source_reference || "").trim();
    const confidence =
      parsed?.confidence === "high" || parsed?.confidence === "medium" || parsed?.confidence === "low"
        ? parsed.confidence
        : "low";
    const rationale = String(parsed?.rationale || "").trim();
    if (!answer) return null;
    return {
      answer,
      selected_label: selectedLabel || "selected area",
      source_reference: sourceReference || "current sheet",
      confidence,
      rationale: rationale || "Visual interpretation from selected area and sheet context.",
    };
  } catch {
    return null;
  }
};

const runVisualSelectionQa = async (params: {
  lovableApiKey: string;
  question: string;
  sampleBase64: string;
  pageBase64: string;
}): Promise<VisualSelectionQaResult | null> => {
  const { lovableApiKey, question, sampleBase64, pageBase64 } = params;
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0.0,
      messages: [
        {
          role: "system",
          content:
            "You are an assistant reading construction plans. Image 1 is the user's selected area (note/callout/symbol/wall). Image 2 is the full sheet. Resolve what the selection refers to by finding matching notes, legends, schedules, keynotes, or detail references on the same sheet image. Return strict JSON: {\"answer\": string, \"selected_label\": string, \"source_reference\": string, \"confidence\": \"high|medium|low\", \"rationale\": string}.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Question: ${question}` },
            { type: "text", text: "Image 1 = selected area. Image 2 = full sheet." },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${sampleBase64}` },
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${pageBase64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) return null;
  const body = await response.json();
  const raw = String(body?.choices?.[0]?.message?.content || "");
  return parseVisualSelectionQaJson(raw);
};

const parseJsonFromModel = (raw: string): AskPlanAiResponse | null => {
  try {
    let jsonStr = extractJsonObject(raw);
    if (jsonStr.includes("```json")) {
      jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (jsonStr.includes("```")) {
      jsonStr = jsonStr.replace(/```\n?/g, "");
    }

    const parsed = JSON.parse(jsonStr);
    const normalized: AskPlanAiResponse = {
      answer: String(parsed?.answer || "").trim(),
      confidence: parsed?.confidence === "high" || parsed?.confidence === "medium" || parsed?.confidence === "low"
        ? parsed.confidence
        : "low",
      citations: Array.isArray(parsed?.citations)
        ? parsed.citations
            .map((c: any) => ({
              source: String(c?.source || "").trim(),
              reason: String(c?.reason || "").trim(),
              target_page_number: Number.isFinite(Number(c?.target_page_number)) ? Number(c.target_page_number) : null,
              target_sheet_number: c?.target_sheet_number ? String(c.target_sheet_number).trim() : null,
            }))
            .filter((c: any) => c.source && c.reason)
        : [],
      needsClarification: !!parsed?.needsClarification,
      clarifyingQuestion: parsed?.clarifyingQuestion ? String(parsed.clarifyingQuestion) : null,
    };

    if (!normalized.answer) return null;
    return normalized;
  } catch {
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "Lovable API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = await req.json();
    const question = String(payload?.question || "").trim();
    if (!question) {
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const plan = payload?.plan || {};
    const selection = payload?.selection || {};
    const context = payload?.context || {};
    const vision = payload?.vision || null;
    const traceId = crypto.randomUUID();
    const selectionArea = normalizeSelectionRect(selection?.selected_area_norm);

    const knownRefs = new Set<string>();
    const knownPageNumbers = new Set<number>();
    const indexedPages: IndexedPage[] = (Array.isArray(context?.indexed_pages) ? context.indexed_pages : [])
      .map((p: any) => ({
        page_number: Number.isFinite(Number(p?.page_number)) ? Number(p.page_number) : null,
        sheet_number: p?.sheet_number ? String(p.sheet_number) : null,
        page_title: p?.page_title ? String(p.page_title) : null,
        discipline: p?.discipline ? String(p.discipline) : null,
      }));
    const linksOnCurrentPage: LinkOnPage[] = (Array.isArray(context?.links_on_current_page) ? context.links_on_current_page : [])
      .map((l: any) => ({
        ref_text: l?.ref_text ? String(l.ref_text) : null,
        target_page_number: Number.isFinite(Number(l?.target_page_number)) ? Number(l.target_page_number) : null,
        target_sheet_number: l?.target_sheet_number ? String(l.target_sheet_number) : null,
        target_title: l?.target_title ? String(l.target_title) : null,
        confidence: Number.isFinite(Number(l?.confidence)) ? Number(l.confidence) : null,
        x_norm: Number.isFinite(Number(l?.x_norm)) ? Number(l.x_norm) : null,
        y_norm: Number.isFinite(Number(l?.y_norm)) ? Number(l.y_norm) : null,
        w_norm: Number.isFinite(Number(l?.w_norm)) ? Number(l.w_norm) : null,
        h_norm: Number.isFinite(Number(l?.h_norm)) ? Number(l.h_norm) : null,
      }));
    const linksInSelectedAreaInput: LinkOnPage[] = (Array.isArray(context?.links_in_selected_area) ? context.links_in_selected_area : [])
      .map((l: any) => ({
        ref_text: l?.ref_text ? String(l.ref_text) : null,
        target_page_number: Number.isFinite(Number(l?.target_page_number)) ? Number(l.target_page_number) : null,
        target_sheet_number: l?.target_sheet_number ? String(l.target_sheet_number) : null,
        target_title: l?.target_title ? String(l.target_title) : null,
        confidence: Number.isFinite(Number(l?.confidence)) ? Number(l.confidence) : null,
        x_norm: Number.isFinite(Number(l?.x_norm)) ? Number(l.x_norm) : null,
        y_norm: Number.isFinite(Number(l?.y_norm)) ? Number(l.y_norm) : null,
        w_norm: Number.isFinite(Number(l?.w_norm)) ? Number(l.w_norm) : null,
        h_norm: Number.isFinite(Number(l?.h_norm)) ? Number(l.h_norm) : null,
      }));
    const selectedLink = selection?.selected_link || null;
    const shouldAttemptVisualCount =
      isCountQuestion(question) &&
      !!vision?.page_image_base64 &&
      !!vision?.selected_area_image_base64 &&
      !!selectionArea;
    const shouldAttemptVisualSelectionQa =
      !isCountQuestion(question) &&
      isSelectionVisionQuestion(question) &&
      !!vision?.page_image_base64 &&
      !!vision?.selected_area_image_base64 &&
      !!selectionArea;
    const derivedLinksInSelectedArea = selectionArea
      ? linksOnCurrentPage.filter((l) => {
          if (![l.x_norm, l.y_norm, l.w_norm, l.h_norm].every((v) => Number.isFinite(Number(v)))) return false;
          return overlaps(selectionArea, {
            x: Number(l.x_norm),
            y: Number(l.y_norm),
            w: Number(l.w_norm),
            h: Number(l.h_norm),
          });
        })
      : [];
    const linksInSelectedArea =
      linksInSelectedAreaInput.length > 0 ? linksInSelectedAreaInput : derivedLinksInSelectedArea;

    indexedPages.forEach((p: any) => {
      const pageNo = Number(p?.page_number);
      if (Number.isFinite(pageNo)) knownPageNumbers.add(pageNo);
      const sheet = normalizeRef(p?.sheet_number);
      if (sheet) knownRefs.add(sheet);
      const title = normalizeRef(p?.page_title);
      if (title) knownRefs.add(title);
      if (Number.isFinite(pageNo)) {
        knownRefs.add(`PAGE${pageNo}`);
        knownRefs.add(`P${pageNo}`);
      }
    });
    linksOnCurrentPage.forEach((l: any) => {
      const refText = normalizeRef(l?.ref_text);
      if (refText) knownRefs.add(refText);
      const targetSheet = normalizeRef(l?.target_sheet_number);
      if (targetSheet) knownRefs.add(targetSheet);
      const targetPage = Number(l?.target_page_number);
      if (Number.isFinite(targetPage)) {
        knownPageNumbers.add(targetPage);
        knownRefs.add(`PAGE${targetPage}`);
        knownRefs.add(`P${targetPage}`);
      }
    });
    linksInSelectedArea.forEach((l: any) => {
      const refText = normalizeRef(l?.ref_text);
      if (refText) knownRefs.add(refText);
      const targetSheet = normalizeRef(l?.target_sheet_number);
      if (targetSheet) knownRefs.add(targetSheet);
      const targetPage = Number(l?.target_page_number);
      if (Number.isFinite(targetPage)) {
        knownPageNumbers.add(targetPage);
        knownRefs.add(`PAGE${targetPage}`);
        knownRefs.add(`P${targetPage}`);
      }
    });

    const userPrompt = {
      question,
      plan,
      selection: {
        ...selection,
        selected_area_norm: selectionArea,
      },
      context,
      selection_context: {
        links_in_selected_area: linksInSelectedArea.slice(0, 10),
      },
    };

    if (shouldAttemptVisualCount) {
      try {
        const sampleBase64 = String(vision.selected_area_image_base64 || "");
        const pageBase64 = String(vision.page_image_base64 || "");
        const pass1 = await runVisualCountPass({
          lovableApiKey,
          question,
          sampleBase64,
          pageBase64,
          strictMode: false,
        });
        const pass2 = await runVisualCountPass({
          lovableApiKey,
          question,
          sampleBase64,
          pageBase64,
          strictMode: true,
        });

        const candidates = [pass1, pass2].filter((p): p is VisualCountResult => !!p);
        if (candidates.length > 0) {
          const currentPage = Number(selection?.current_page_number);
          const currentSheet = selection?.current_sheet_number ? String(selection.current_sheet_number) : null;
          const sheetLabel = currentSheet || (Number.isFinite(currentPage) ? `Page ${currentPage}` : "current sheet");
          const counts = candidates.map((c) => c.count_on_page).sort((a, b) => a - b);
          const minCount = counts[0];
          const maxCount = counts[counts.length - 1];
          const countSpread = maxCount - minCount;
          const agreed = countSpread <= Math.max(1, Math.round(maxCount * 0.1));
          const medianCount = counts[Math.floor(counts.length / 2)];
          const primary = candidates[0];
          const confidence: "high" | "medium" | "low" = agreed
            ? (candidates.some((c) => c.confidence === "high") ? "high" : "medium")
            : "low";

          const answer = agreed
            ? `Based on ${sheetLabel}, I count about ${medianCount} ${primary.object_name}${medianCount === 1 ? "" : "s"} on this page.`
            : `Based on ${sheetLabel}, I estimate ${minCount}-${maxCount} ${primary.object_name}${maxCount === 1 ? "" : "s"} on this page (low confidence due to visual ambiguity).`;

          const rationaleParts = candidates.map((c, idx) => `pass ${idx + 1}: ${c.rationale}`);
          const result: AskPlanAiResponse = {
            answer,
            confidence,
            citations: [
              {
                source: sheetLabel,
                reason: rationaleParts.join(" | "),
                target_page_number: Number.isFinite(currentPage) ? currentPage : null,
                target_sheet_number: currentSheet,
              },
            ],
            needsClarification: confidence === "low",
            clarifyingQuestion:
              confidence === "low"
                ? "For a tighter count, zoom in and select a single clear symbol sample (not from legend/schedule), then ask again."
                : null,
            traceId,
          };

          return new Response(JSON.stringify({ result }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (countError) {
        console.warn("A-RFI visual count path failed; falling back to standard logic", countError);
      }
    }

    if (shouldAttemptVisualSelectionQa) {
      try {
        const sampleBase64 = String(vision.selected_area_image_base64 || "");
        const pageBase64 = String(vision.page_image_base64 || "");
        const visualQa = await runVisualSelectionQa({
          lovableApiKey,
          question,
          sampleBase64,
          pageBase64,
        });

        if (visualQa) {
          const currentPage = Number(selection?.current_page_number);
          const currentSheet = selection?.current_sheet_number ? String(selection.current_sheet_number) : null;
          const sheetLabel = currentSheet || (Number.isFinite(currentPage) ? `Page ${currentPage}` : "current sheet");
          const result: AskPlanAiResponse = {
            answer: visualQa.answer.startsWith("Based on")
              ? visualQa.answer
              : `Based on ${sheetLabel}, ${visualQa.answer}`,
            confidence: visualQa.confidence,
            citations: [
              {
                source: visualQa.source_reference || sheetLabel,
                reason: `${visualQa.rationale} Selected item: ${visualQa.selected_label}.`,
                target_page_number: Number.isFinite(currentPage) ? currentPage : null,
                target_sheet_number: currentSheet,
              },
            ],
            needsClarification: visualQa.confidence === "low",
            clarifyingQuestion:
              visualQa.confidence === "low"
                ? "If this is not the intended symbol/note, select a tighter area around the exact reference and ask again."
                : null,
            traceId,
          };

          return new Response(JSON.stringify({ result }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (visualQaError) {
        console.warn("A-RFI visual selected-area QA failed; falling back to standard logic", visualQaError);
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are a construction plan assistant for Builderlynk A-RFI. Use ONLY the provided plan context. Prioritize evidence from selection_context.links_in_selected_area, then selected_link, then other links. If data is missing, say so. Never invent sheet/detail references. Return strict JSON with keys: answer, confidence, citations, needsClarification, clarifyingQuestion. citations must be an array of objects {source, reason, target_page_number, target_sheet_number}. confidence must be one of high|medium|low.",
          },
          {
            role: "user",
            content:
              "Answer the plan question using only provided context and include citations. Start answer with \"Based on ...\" when evidence exists. If evidence is weak, set confidence to low and ask a clarifying question. Context JSON:\n" +
              JSON.stringify(userPrompt),
          },
        ],
      }),
    });

    if (!response.ok) {
      const msg = await response.text();
      return new Response(
        JSON.stringify({ error: `AI request failed: ${response.status}`, details: msg }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await response.json();
    const raw = String(body?.choices?.[0]?.message?.content || "");
    const parsed = parseJsonFromModel(raw);

    const deterministicFallback = (): AskPlanAiResponse => {
      const topAreaLinks = linksInSelectedArea
        .slice()
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
        .slice(0, 2);
      if (topAreaLinks.length > 0) {
        return {
          answer:
            "Based on the selected area, these linked sheets are the strongest evidence for your question. Open them to confirm wall assembly/spec details.",
          confidence: "medium",
          citations: topAreaLinks.map((l) => ({
            source: `Area reference ${l.ref_text || "link on selected area"}`,
            reason: "Detected link intersects the selected plan area.",
            target_page_number: l.target_page_number,
            target_sheet_number: l.target_sheet_number,
          })),
          needsClarification: false,
          clarifyingQuestion: null,
          traceId,
        };
      }

      if (selectedLink?.target_page_number || selectedLink?.target_sheet_number) {
        const targetPage = Number.isFinite(Number(selectedLink?.target_page_number))
          ? Number(selectedLink.target_page_number)
          : null;
        const targetSheet = selectedLink?.target_sheet_number ? String(selectedLink.target_sheet_number) : null;
        return {
          answer:
            `The strongest reference from your current selection points to ${targetSheet || (targetPage ? `Page ${targetPage}` : "another sheet")}. Open that sheet for the detail/specs tied to this callout.`,
          confidence: "medium",
          citations: [
            {
              source: `Selected reference ${selectedLink?.ref_text || ""}`.trim(),
              reason: "This is the explicit link selected by the user on the current sheet.",
              target_page_number: targetPage,
              target_sheet_number: targetSheet,
            },
          ],
          needsClarification: false,
          clarifyingQuestion: null,
          traceId,
        };
      }

      const topLinks = linksOnCurrentPage
        .slice()
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
        .slice(0, 2);
      if (topLinks.length > 0) {
        return {
          answer:
            "I cannot confirm a single definitive sheet yet, but these linked sheets on the current page are the most likely places to find the requested detail/spec.",
          confidence: "low",
          citations: topLinks.map((l) => ({
            source: `Reference ${l.ref_text || "link on current sheet"}`,
            reason: "Detected inter-sheet link on current page.",
            target_page_number: l.target_page_number,
            target_sheet_number: l.target_sheet_number,
          })),
          needsClarification: true,
          clarifyingQuestion: "Which reference bubble should I use for your question?",
          traceId,
        };
      }

      if (selectionArea) {
        return {
          answer:
            "No linked references were detected inside the selected area. Select a nearby callout/detail bubble or ask with a specific sheet reference.",
          confidence: "low",
          citations: [],
          needsClarification: true,
          clarifyingQuestion: "Can you select the callout bubble or note tied to this wall?",
          traceId,
        };
      }

      return {
        answer: "I could not produce a grounded answer from the current plan context. Try selecting a reference hotspot or asking about a specific sheet.",
        confidence: "low",
        citations: [],
        needsClarification: true,
        clarifyingQuestion: "Which sheet or reference should I use for this question?",
        traceId,
      };
    };

    if (!parsed) {
      return new Response(
        JSON.stringify({
          result: deterministicFallback(),
          raw,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const repairedCitations = parsed.citations.map((c) => {
      let targetPage = Number.isFinite(Number(c.target_page_number)) ? Number(c.target_page_number) : null;
      let targetSheet = c.target_sheet_number ? String(c.target_sheet_number) : null;
      if (!targetPage) targetPage = extractPageFromText(c.source);
      if (!targetSheet) targetSheet = extractSheetFromText(c.source);

      const normalizedSheet = normalizeRef(targetSheet);
      if (!targetPage && normalizedSheet) {
        const pageMatch = indexedPages.find((p) => normalizeRef(p.sheet_number) === normalizedSheet);
        if (pageMatch?.page_number) targetPage = pageMatch.page_number;
      }
      if (!targetSheet && targetPage) {
        const pageMatch = indexedPages.find((p) => p.page_number === targetPage);
        if (pageMatch?.sheet_number) targetSheet = pageMatch.sheet_number;
      }

      return {
        ...c,
        target_page_number: targetPage,
        target_sheet_number: targetSheet,
      };
    });

    const groundedCitations = dedupeCitations(repairedCitations).filter((c) => {
      const hasKnownSource = textContainsKnownReference(c.source, knownRefs);
      const targetPage = c.target_page_number;
      const targetSheet = normalizeRef(c.target_sheet_number);
      const knownTargetPage = Number.isFinite(targetPage) && knownPageNumbers.has(Number(targetPage));
      const knownTargetSheet = !!targetSheet && knownRefs.has(targetSheet);
      return hasKnownSource || knownTargetPage || knownTargetSheet;
    }).slice(0, 6);

    const finalResult: AskPlanAiResponse = {
      ...parsed,
      citations: groundedCitations,
      traceId,
    };

    if (groundedCitations.length === 0 || ((parsed.confidence === "high" || parsed.confidence === "medium") && groundedCitations.length < 1)) {
      finalResult.confidence = "low";
      finalResult.needsClarification = true;
      finalResult.clarifyingQuestion = finalResult.clarifyingQuestion || "I need a specific sheet/detail reference to answer this confidently. Which one should I use?";
      if (!finalResult.answer.toLowerCase().includes("could not") && !finalResult.answer.toLowerCase().includes("insufficient")) {
        finalResult.answer = "I cannot confirm that from grounded plan evidence yet. Please pick a specific sheet or reference hotspot and ask again.";
      }

      const fallback = deterministicFallback();
      if (fallback.citations.length > 0) {
        finalResult.answer = fallback.answer;
        finalResult.citations = fallback.citations;
        finalResult.needsClarification = fallback.needsClarification;
        finalResult.clarifyingQuestion = fallback.clarifyingQuestion;
      }
    }

    return new Response(JSON.stringify({ result: finalResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ask-plan-ai failed", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

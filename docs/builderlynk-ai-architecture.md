# BuilderLYNK Custom AI Architecture (Implementation Guide)

## 1. Goal
Build a BuilderLYNK-specific AI system that can:
- Answer plan/spec questions with citations (ARFI/A-RFI)
- Use selection context (sheet, bbox, symbol/note)
- Execute safe app actions via tools (navigation, lookups, counts)
- Respect role/company permissions end-to-end

## 2. Core Stack
- Model layer: OpenAI API
- Orchestration: Backend service (Supabase Edge Functions or Node API)
- Data: Supabase Postgres + Storage + pgvector
- UI: Existing BuilderLYNK React app

Recommended principle:
- Model decides intent/tool usage
- Backend executes tools and enforces auth/permissions
- Model never gets raw unrestricted DB access

## 3. High-Level Architecture
1. Client sends:
- user message
- selected context (`company_id`, `job_id`, `sheet_id`, `bbox`, `selected_text`, route)
2. AI orchestrator:
- validates session and permissions
- builds prompt context
- calls model with tool definitions
3. Model may call tools (one or more)
4. Backend executes tool handlers and returns structured JSON
5. Model generates grounded answer
6. UI renders:
- answer
- citations (sheet/page/spec links)
- confidence and optional follow-up prompts

## 4. Tooling Strategy
Define narrow, auditable tools. Example tool set:

- `arfi_search_plan_chunks`
  - Input: `company_id`, `job_id`, `query`, `sheet_ids?`, `bbox?`, `top_k`
  - Output: chunks with `sheet_number`, `page`, `text`, `source_url`, `bbox`

- `arfi_lookup_note`
  - Input: `job_id`, `sheet_id`, `note_number`
  - Output: note text + references

- `arfi_get_wall_assembly`
  - Input: `job_id`, `sheet_id`, `bbox`
  - Output: assembly details + referenced details/spec sections

- `arfi_count_symbols`
  - Input: `job_id`, `sheet_id`, `symbol_type`, `bbox?`
  - Output: count + symbol matches/bboxes

- `arfi_open_deeplink`
  - Input: `target_type`, `target_id`, `query_params?`
  - Output: route to open in UI

- `arfi_get_user_permissions`
  - Input: session/user context
  - Output: capability flags used by orchestrator and answer policy

## 5. Data Model (Minimum)
Add tables (or extend existing) for AI operations:

- `ai_documents`
  - `id`, `company_id`, `job_id`, `doc_type`, `source_path`, `version`, `created_at`

- `ai_chunks`
  - `id`, `document_id`, `company_id`, `job_id`, `sheet_id`, `sheet_number`, `page_number`
  - `text`, `token_count`, `bbox`, `metadata_json`, `embedding vector`

- `ai_sessions`
  - `id`, `company_id`, `user_id`, `job_id`, `context_json`, `created_at`

- `ai_messages`
  - `id`, `session_id`, `role`, `content`, `tool_calls_json`, `created_at`

- `ai_feedback`
  - `id`, `message_id`, `user_id`, `helpful boolean`, `reason`, `created_at`

- `ai_eval_cases`
  - expected answer/citations for regression testing

## 6. RAG and Ingestion Pipeline
1. Ingest docs from storage (plans/specs/addenda)
2. Parse PDF/OCR and preserve layout coordinates
3. Split by semantic chunks (detail blocks, notes, spec paragraphs)
4. Attach metadata:
- `sheet_number`, `page`, `bbox`, `discipline`, `revision`
5. Create embeddings and upsert into `ai_chunks`
6. Re-index on new revision upload

Retrieval policy:
- prioritize selected `sheet_id` and `bbox`
- then nearby chunks on same sheet
- then project-wide chunks
- optionally spec book fallback

## 7. Grounded Answer Contract
Every ARFI answer should return:
- `answer_text`
- `citations[]` with:
  - `sheet/page`
  - `source_excerpt`
  - `source_link`
  - optional `bbox`
- `confidence` (low/med/high)
- `limitations` when evidence is insufficient

If insufficient evidence:
- do not hallucinate
- propose one concrete next action (e.g., “select note cloud on A3.3”)

## 8. Permission and Security Model
Enforce at tool layer, not prompt layer only.

Checks required per request:
- authenticated user
- active company membership
- role permission flags
- job-level access (if scoped)
- document ACL (if private)

Audit:
- log every tool call with user/company/job and result status
- redact sensitive fields in logs

## 9. UX Guidelines (BuilderLYNK)
- Entry point: selection-first AI panel in plan viewer
- Context chips: `Sheet A3.3`, `Selection`, `Discipline`
- Suggested prompts should be dynamic by selection type:
  - note selected: “What does note 12 mean?”
  - wall selected: “What is this wall assembly?”
  - symbol selected: “How many of these on this sheet?”
- Helpful/not helpful feedback writes to `ai_feedback`
- Clicking citation deep-links to exact sheet/page (and bbox highlight if available)

## 10. Evaluation Framework (Must Have)
Create eval sets by workflow:
- note lookup
- detail/assembly lookup
- spec section mapping
- symbol count
- unsupported question handling

Metrics:
- citation accuracy
- groundedness
- task success
- latency p50/p95
- tool error rate

Gate releases on eval thresholds.

## 11. Rollout Plan
Phase 1:
- Read-only ARFI Q&A with citations on selected sheet
- No write actions

Phase 2:
- Counting and structured extract tools
- Better suggested prompts

Phase 3:
- Cross-document reasoning (plans + specs + RFIs)
- Team-level feedback analytics dashboard

Phase 4:
- Advanced automations (draft RFI from selection, draft submittal questions)

## 12. Concrete Next Build Steps
1. Create `ai_documents`, `ai_chunks`, `ai_sessions`, `ai_messages`, `ai_feedback` migrations
2. Implement ingestion worker for plan/spec files
3. Add `arfi_search_plan_chunks` + `arfi_lookup_note` tool handlers
4. Add ARFI orchestrator endpoint (`/api/ai/arfi/query`)
5. Add citation UI model in plan viewer
6. Add feedback capture + basic eval runner

## 13. Non-Goals (for v1)
- Full autonomous workflow execution
- Fine-tuning custom model before retrieval/tools are mature
- Unbounded project-wide answering without user context

## 14. Implementation Notes for Current Repo
- Existing deep-link routing and query-param patterns can be reused for citations
- Existing role permission framework can host new AI capability keys if needed
- Keep tool handlers as isolated server functions for easier auditing and tests

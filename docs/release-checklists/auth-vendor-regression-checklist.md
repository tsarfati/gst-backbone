# Auth / Vendor Regression Checklist

Run this before any deploy or Lovable sync that touches auth, onboarding, invitations, company context, or vendor portal flows.

## BuilderLYNK main auth
- [ ] Internal user logging in from main auth lands in BuilderLYNK dashboard
- [ ] Internal user sees BuilderLYNK sidebar, not vendor sidebar
- [ ] Company switcher only shows internal companies

## Vendor portal auth
- [ ] Vendor portal login page shows correct company branding
- [ ] Vendor invite signup page shows locked email
- [ ] Vendor invite signup page shows locked invited vendor/company name
- [ ] Vendor signup confirmation returns to vendor flow, not generic BuilderLYNK onboarding
- [ ] Vendor login lands in vendor dashboard
- [ ] Vendor login shows vendor sidebar only
- [ ] Vendor login does not show BuilderLYNK accounting/construction widgets

## Same-email dual identity
- [ ] Same-email user logging in from BuilderLYNK main auth lands in BuilderLYNK workspace
- [ ] Same-email user logging in from company vendor portal lands in that vendor portal
- [ ] No mixed dashboard shell on either path

## Invite and repair flows
- [ ] Internal BuilderLYNK invite accepts cleanly
- [ ] Vendor invite accepts cleanly
- [ ] No access-request loop after acceptance
- [ ] No forced generic profile completion for vendor flow

## Company context
- [ ] Internal company switching persists after page refresh
- [ ] Vendor memberships do not leak into BuilderLYNK company switcher
- [ ] Vendor portal stays pinned to the selected builder company

## Vendor shared-job access
- [ ] Vendor can open a job from `/vendor/jobs`
- [ ] Vendor job detail page does not show `No job available` for a listed shared job
- [ ] Vendor does not see `Create New Job`
- [ ] `Plans` shows builder-side plan sets when shared/enabled
- [ ] `Filing Cabinet` shows shared cabinet content when enabled
- [ ] `Photos` shows builder-side albums/photos when shared/enabled
- [ ] Shared-job tabs do not render empty fallback states just because vendor workspace company differs from builder company

## User removal / ghost cleanup
- [ ] Removed internal user disappears from `System Users`
- [ ] Removed vendor portal user disappears from vendor modal
- [ ] Removed vendor portal user disappears from `Vendor Access Users`
- [ ] No stale pending invites/access requests keep removed user visible

## Punch Clock sanity checks
- [ ] Deleted/removed users do not still win PIN login
- [ ] Duplicate PINs are blocked

## If any item fails
- Stop deploy
- Capture:
  - exact entry URL
  - email used
  - expected destination
  - actual destination
  - console/network error if present
- Fix and rerun the checklist

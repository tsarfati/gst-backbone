# Critical Auth and Workspace Workflows

These flows are protected. Changes that touch auth, onboarding, company context, vendor portal context, profile completion, invitations, or routing must be checked against every flow below before deploy.

## Core rules

1. One email can belong to multiple identities/contexts.
2. BuilderLYNK main login and vendor portal login are different entry flows.
3. Entry flow determines destination workspace.
4. Vendor portal onboarding must stay inside vendor portal flow.
5. BuilderLYNK onboarding must stay inside BuilderLYNK flow.
6. Same-email users must never be forced into the wrong workspace just because another identity exists.

## Protected flows

### 1. BuilderLYNK internal login
- Entry: `builderlink.com` main auth page
- User type: internal BuilderLYNK user
- Expected:
  - lands in BuilderLYNK dashboard
  - sees BuilderLYNK sidebar
  - company switcher shows internal companies only
  - never lands in vendor dashboard automatically

### 2. Vendor-only login from main site
- Entry: `builderlink.com` main auth page
- User type: vendor-only user
- Expected:
  - does not land in a random vendor dashboard
  - goes to vendor portal chooser or explicit vendor flow
  - no BuilderLYNK internal company shell

### 3. Vendor portal login
- Entry: company-specific vendor login page
- User type: vendor portal user
- Expected:
  - lands in vendor dashboard for that builder company portal
  - sees vendor sidebar only
  - does not see BuilderLYNK accounting/construction shell
  - portal context is pinned to the selected builder company

### 4. Same-email internal + vendor login
- Entry A: main BuilderLYNK auth page
- Expected A:
  - lands in BuilderLYNK workspace
- Entry B: company-specific vendor portal login
- Expected B:
  - lands in that vendor portal workspace
- Rule:
  - same email can validly enter different workspaces depending on entry point

### 5. Vendor invite signup
- Entry: vendor invitation link
- Expected:
  - locked email shown
  - locked invited vendor/company field shown
  - create account stays inside vendor-branded page
  - email confirmation returns to vendor flow, not BuilderLYNK onboarding

### 6. Vendor invite confirmation
- Entry: confirmed vendor invite return
- Expected:
  - no generic `/profile-completion`
  - user returns to vendor login or vendor dashboard flow
  - vendor context stays pinned to invited company

### 7. Internal user invite acceptance
- Entry: BuilderLYNK invite link or sign-in flow
- Expected:
  - user account repaired/accepted into correct internal company
  - no stale pending/rejected request loops
  - company role and session metadata align after next login

### 8. Company switching
- Entry: internal BuilderLYNK dashboard
- Expected:
  - internal company switch persists
  - vendor memberships do not appear in BuilderLYNK company switcher
  - switching companies does not snap back unexpectedly

### 9. Vendor portal user removal
- Entry: builder-side vendor portal user management
- Expected:
  - removing vendor portal user removes company-specific vendor access
  - removed user disappears from vendor portal modal
  - removed user disappears from `User Management -> Vendor Access Users`
  - stale ghost rows do not remain from revoked invitations or leftover access rows

### 10. Profile completion
- Internal users:
  - generic `/profile-completion` is valid
- Vendor/design-professional portal users:
  - generic `/profile-completion` is not valid as an onboarding redirect
  - completion should happen only inside portal-specific flows/screens

### 11. Vendor job access
- Entry: vendor portal dashboard -> jobs list -> specific shared job
- Expected:
  - jobs visible in `/vendor/jobs` must open successfully
  - vendor job detail page must use builder-owned job context, not vendor workspace company context
  - enabled tabs show real shared project data
  - disabled tabs stay hidden rather than showing empty/internal-state fallbacks
  - vendor users must never see `Create New Job`

### 12. Vendor shared-job modules
- Entry: vendor job detail tabs
- Expected:
  - `Plans` loads builder-side plan sets for that shared job
  - `Filing Cabinet` respects vendor job assignment access and shows shared files when enabled
  - `Photos` loads builder-side albums/photos for that shared job
  - empty-state messages are only valid when the underlying builder-side job is actually empty

## Red-flag changes

Any code changes touching these files or concerns require full regression checking:
- `src/components/AccessControl.tsx`
- `src/components/RoleGuard.tsx`
- `src/components/AppLayout.tsx`
- `src/hooks/useRoleBasedRouting.ts`
- `src/contexts/CompanyContext.tsx`
- `src/contexts/AuthContext.tsx`
- `src/pages/Auth.tsx`
- `src/pages/VendorLogin.tsx`
- `src/pages/VendorSignup.tsx`
- `src/pages/VendorRegister.tsx`
- `src/pages/VendorPortalChooser.tsx`
- `src/pages/VendorPortalJobs.tsx`
- `supabase/functions/finalize-vendor-invite-registration/index.ts`
- `supabase/functions/manage-vendor-portal-users/index.ts`
- `src/pages/JobDetails.tsx`
- `src/components/JobPlans.tsx`
- `src/components/JobFilingCabinet.tsx`
- `src/components/JobPhotoAlbum.tsx`
- any code that writes:
  - `profiles.role`
  - `profiles.current_company_id`
  - `profiles.default_company_id`
  - `profiles.vendor_id`
  - `profiles.vendor_portal_role`
  - `user_company_access`
  - `company_access_requests`
  - `vendor_invitations`

## Test personas to preserve

Keep stable seeded accounts for:
- internal-only admin
- internal-only employee
- vendor-only user
- same-email internal + vendor user
- invited vendor pending confirmation
- invited vendor confirmed but first login not completed
- removed vendor portal user

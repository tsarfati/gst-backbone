

## Build Errors + Email Domain Update Plan

There are **three build errors** to fix, plus your request to update all email sender addresses from `@greenstarteam.com` to `@builderlynk.com`.

---

### 1. Fix Build Errors

**Error 1**: `check-subscription/index.ts` — references `npm:@supabase/supabase-js@2.57.2` which doesn't resolve. The function file appears to be missing or was deleted. We need to recreate it (or fix the import to use `https://esm.sh/@supabase/supabase-js@2` like other functions).

**Error 2**: `src/App.tsx` imports `./pages/SettingsHelpDatabase` which doesn't exist. We need to either create a stub page or remove the import and route.

**Error 3**: `src/App.tsx` imports `@/hooks/useCompanyFeatureAccess` which doesn't exist. We need to create a stub hook or remove the import and usage.

### 2. Update Email Sender Domain

All edge functions currently send from `noreply@greenstarteam.com`. We need to update every occurrence across these functions to `noreply@builderlynk.com`:

- `supabase/functions/send-auth-email/index.ts` — `from: 'BuilderLYNK <noreply@greenstarteam.com>'`
- `supabase/functions/send-password-reset/index.ts` — `from: 'BuilderLynk <noreply@greenstarteam.com>'`
- `supabase/functions/send-email/index.ts` — likely has a from address too
- Any other edge functions that send email (e.g., `send-bill-approval-notification`, `send-credit-card-coding-notification`, `send-file-share-email`, `send-financial-overview`, `send-overdue-bill-notifications`, `send-rfp-invite`, `send-test-email`, `send-user-invite`, `send-vendor-invite`, `send-visitor-sms`)

All `from:` fields will be changed to use `@builderlynk.com`.

### 3. Redeploy All Affected Edge Functions

After updating, all modified edge functions will be deployed.

---

### Steps

1. Fix the three build errors (missing module stubs or import removals)
2. Update every email-sending edge function's `from` address from `@greenstarteam.com` to `@builderlynk.com`
3. Deploy all updated edge functions


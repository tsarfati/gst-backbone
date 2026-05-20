# Playwright Smoke Suite

This is the first automated regression layer for the auth, workspace, and vendor portal workflows.

## Purpose

Run these tests before any GitHub push or Lovable sync that touches:
- auth
- onboarding
- company context
- vendor portal routing
- same-email workspace behavior

These are smoke tests, not full QA. They answer one question quickly:
- did we break the critical login and workspace flows?

## Covered workflows

Current suite:
- BuilderLYNK internal login
- vendor portal login
- same-email BuilderLYNK + vendor split
- workspace chooser

The next wave should add:
- vendor invite signup
- vendor shared-job open
- vendor job tab checks for plans / photos / RFPs / subcontracts

## Setup

1. Copy the example env file:

```bash
cp .env.playwright.example .env.playwright
```

2. Fill in the test accounts and URLs.

3. Export the variables into your shell before running the suite. Example:

```bash
set -a
source .env.playwright
set +a
```

4. Install the browser once if needed:

```bash
npx playwright install chromium
```

## Commands

List tests:

```bash
npm run test:smoke:list
```

Run headless:

```bash
npm run test:smoke
```

Run headed:

```bash
npm run test:smoke:headed
```

## Notes

- Tests skip themselves when the required env vars are missing.
- `PW_VENDOR_LOGIN_URL` should be a company-specific vendor portal login URL.
- `PW_SAME_EMAIL_USER_*` should be a user that can validly enter BuilderLYNK from main auth and a vendor portal from the vendor login URL.
- `PW_WORKSPACE_CHOOSER_USER_*` should be a user that truly should land on `Choose Workspace` from main auth.

## Release workflow

Recommended order before deploy:

1. run local preview
2. run `npm run test:smoke`
3. run the manual checklist in `docs/release-checklists/auth-vendor-regression-checklist.md`
4. push to GitHub
5. sync in Lovable
6. do one live verification pass

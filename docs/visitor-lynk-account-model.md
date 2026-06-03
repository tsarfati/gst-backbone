# VisitorLYNK Account Model

## Decision

VisitorLYNK should be a branded BuilderLYNK entry product, not a separate platform.

Customers who sign up for VisitorLYNK should still create a normal BuilderLYNK company and tenant behind the scenes, but their account experience should be restricted to visitor-related workflows.

## Why

- keeps visitor logs tied to real jobs from day one
- avoids building and maintaining a second identity and sync system
- makes future upsell into full BuilderLYNK much easier
- preserves the existing visitor login / checkout / reporting infrastructure

## Customer Experience

The customer should feel like they are buying and onboarding into VisitorLYNK, not the entire BuilderLYNK suite.

Initial onboarding should feel like:

1. Create company
2. Create first site / job
3. Turn on visitor check-in
4. Generate QR poster
5. Start using VisitorLYNK

It should not feel like:

- accounting setup
- vendor setup
- customer setup
- construction operations setup

## Restricted BuilderLYNK Account

The VisitorLYNK starter account should be feature-gated to a narrow surface area:

- jobs
  - create first job
  - edit basic job info
- visitor login settings
- job visitor settings
- QR generation / poster flow
- visitor dashboard / visitor logs / visitor reports
- minimal company profile settings

Everything else should be hidden or locked:

- payables
- receivables
- vendors
- subcontracts
- purchase orders
- time tracking
- accounting
- construction financial dashboards

## Recommended Implementation

### Phase 1

- launch a VisitorLYNK branded landing page
- route signups into standard BuilderLYNK auth
- manually or tier-based restrict the account to visitor-only features

### Phase 2

- add a VisitorLYNK-specific onboarding wizard
- simplify first-run setup around:
  - company name
  - first jobsite
  - visitor branding
  - QR generation

### Phase 3

- add explicit upgrade paths into full BuilderLYNK
- unlock modules by subscription tier / company feature flags

## Product Positioning

VisitorLYNK is a focused front-end experience on top of the BuilderLYNK platform.

That means:

- separate marketing story
- simpler onboarding
- same backend platform
- same long-term customer record

## Immediate Branch Goal

On this branch, the first goal is to shape VisitorLYNK as a visible, real product surface while preserving the existing shared platform architecture.

import { expect, type Page } from '@playwright/test';
import type { SmokeUser } from './env';

export async function loginFromMainAuth(page: Page, user: SmokeUser) {
  await page.goto('/auth');
  await expect(page.locator('#signin-email')).toBeVisible();
  await page.locator('#signin-email').fill(user.email);
  await page.locator('#signin-password').fill(user.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

export async function loginFromVendorPortal(page: Page, vendorLoginUrl: string, user: SmokeUser) {
  await page.goto(vendorLoginUrl);
  await expect(page.locator('#login-email')).toBeVisible();
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill(user.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

export async function expectNotProfileCompletion(page: Page) {
  await expect(page.getByText(/complete your profile/i)).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/profile-completion/i);
}

export async function expectBuilderWorkspace(page: Page) {
  await expect(page).toHaveURL(/\/dashboard/i);
  await expect(page).not.toHaveURL(/\/vendor\//i);
  await expect(page).not.toHaveURL(/\/design-professional\//i);
  await expectNotProfileCompletion(page);
}

export async function expectVendorWorkspace(page: Page) {
  await expect(page).toHaveURL(/\/vendor\//i);
  await expect(page).not.toHaveURL(/\/profile-completion/i);
  await expect(page.getByText(/complete your profile/i)).toHaveCount(0);
}

export async function expectWorkspaceChooser(page: Page) {
  await expect(page).toHaveURL(/\/workspace\/select/i);
  await expect(page.getByRole('heading', { name: /choose a workspace/i })).toBeVisible();
}

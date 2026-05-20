import { test, expect } from '@playwright/test';
import { getSmokeEnv, hasUser } from './helpers/env';
import { expectVendorWorkspace, loginFromVendorPortal } from './helpers/auth';

const env = getSmokeEnv();

test.describe('smoke: vendor portal auth', () => {
  test.skip(!hasUser(env.vendorPortalUser) || !env.vendorLoginUrl, 'PW_VENDOR_USER_* and PW_VENDOR_LOGIN_URL are required');

  test('company-specific vendor login stays in vendor portal flow', async ({ page }) => {
    await loginFromVendorPortal(page, env.vendorLoginUrl!, env.vendorPortalUser!);
    await expectVendorWorkspace(page);
    await expect(page.getByText(/vendor/i).first()).toBeVisible();

    if (env.vendorExpectedCompanyName) {
      await expect(page.getByText(new RegExp(env.vendorExpectedCompanyName, 'i')).first()).toBeVisible();
    }
  });
});

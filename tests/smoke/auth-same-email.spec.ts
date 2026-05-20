import { test } from '@playwright/test';
import { getSmokeEnv, hasUser } from './helpers/env';
import { expectBuilderWorkspace, expectVendorWorkspace, loginFromMainAuth, loginFromVendorPortal } from './helpers/auth';

const env = getSmokeEnv();

test.describe('smoke: same-email split identity', () => {
  test.skip(!hasUser(env.sameEmailUser) || !env.vendorLoginUrl, 'PW_SAME_EMAIL_USER_* and PW_VENDOR_LOGIN_URL are required');

  test('main auth keeps same-email user in BuilderLYNK workspace', async ({ page }) => {
    await loginFromMainAuth(page, env.sameEmailUser!);
    await expectBuilderWorkspace(page);
  });

  test('vendor portal auth sends same-email user into vendor workspace', async ({ page }) => {
    await loginFromVendorPortal(page, env.vendorLoginUrl!, env.sameEmailUser!);
    await expectVendorWorkspace(page);
  });
});

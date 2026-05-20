import { test, expect } from '@playwright/test';
import { getSmokeEnv, hasUser } from './helpers/env';
import { expectBuilderWorkspace, loginFromMainAuth } from './helpers/auth';

const env = getSmokeEnv();

test.describe('smoke: builder internal auth', () => {
  test.skip(!hasUser(env.internalUser), 'PW_INTERNAL_USER_EMAIL and PW_INTERNAL_USER_PASSWORD are required');

  test('main auth sends established internal user into BuilderLYNK workspace', async ({ page }) => {
    await loginFromMainAuth(page, env.internalUser!);
    await expectBuilderWorkspace(page);
    await expect(page.getByRole('button', { name: /help/i })).toBeVisible();
  });
});

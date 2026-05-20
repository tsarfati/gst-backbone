import { test } from '@playwright/test';
import { getSmokeEnv, hasUser } from './helpers/env';
import { expectWorkspaceChooser, loginFromMainAuth } from './helpers/auth';

const env = getSmokeEnv();

test.describe('smoke: workspace chooser', () => {
  test.skip(!hasUser(env.workspaceChooserUser), 'PW_WORKSPACE_CHOOSER_USER_* are required');

  test('main auth shows chooser for users with multiple valid workspaces', async ({ page }) => {
    await loginFromMainAuth(page, env.workspaceChooserUser!);
    await expectWorkspaceChooser(page);
  });
});

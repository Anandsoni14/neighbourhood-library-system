import { expect, test } from '@playwright/test';

test('app boots and renders the title', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Library Management System');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Library Management System');
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing page has no critical accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Selina|Vibe|Vite/i);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(item => ['critical', 'serious'].includes(item.impact));
  expect(serious).toEqual([]);
});

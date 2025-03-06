import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('https://www.cardiff.ac.uk/__streamline/switcher/');
  await page.waitForTimeout(10000)
});
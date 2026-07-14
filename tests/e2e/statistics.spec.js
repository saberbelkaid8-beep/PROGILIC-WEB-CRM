import { mockFirebase } from "./firebase-mock.js";
import { test, expect } from '@playwright/test';

test.describe('Statistics', () => {
  const testEmail = `stats_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  test.beforeEach(async ({ page }) => {
    await mockFirebase(page, testEmail);
    await page.goto('/');
    await page.locator('text=Sign up').click();
    await page.fill('input[name="fullname"]', 'Stats User');
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator('.hdr')).toBeVisible({ timeout: 15000 });
  });

  test('should update statistics when client is created and deleted', async ({ page }) => {
    // Check initial stats (should be 0 or whatever the mock sets)
    const statsText = await page.locator('.stat-v').first().textContent();
    const initialCount = parseInt(statsText || '0');

    // Create client
    await page.locator('button', { hasText: 'إضافة عميل' }).click();
    await page.fill('#f_fn', 'Stat Client');
    await page.locator('.msheet button', { hasText: 'إضافة العميل' }).click();
    
    // Check if stats incremented
    await expect(page.locator('.stat-v').first()).toHaveText(String(initialCount + 1));
    
    // Delete client
    await page.locator('text=Stat Client').click();
    page.on('dialog', dialog => dialog.accept());
    await page.locator('button', { hasText: 'حذف العميل' }).click();

    // Check if stats decremented
    await expect(page.locator('.stat-v').first()).toHaveText(String(initialCount));
  });
});

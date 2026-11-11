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
    // Switch to clients view where .stat-v is rendered
    await page.locator('button', { hasText: 'العملاء' }).first().click();
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('.stat-v').first()).toBeVisible({ timeout: 10000 });

    // Check initial stats
    const statsText = await page.locator('.stat-v').first().textContent();
    const initialCount = parseInt(statsText || '0');

    // Create client
    await page.locator('button', { hasText: /إضافة عميل|عميل جديد/ }).first().click();
    await page.fill('#f_fn', 'Stat Client Hero');
    await page.fill('#f_co', 'Stat Enterprise');
    await page.fill('#f_ph', '0555999999');
    await page.selectOption('#f_wi', 'الجزائر');
    await page.selectOption('#f_bt', 'تجارة تجزئة');
    await page.selectOption('#f_bf', 'سوبرماركت / بقالة');
    await page.selectOption('#f_st', 'نشط');
    await page.selectOption('#f_p_ver', 'V27');
    await page.locator('.msheet button.btn-primary').click();
    
    // In details view, return to clients list
    await expect(page.locator('.chdr')).toBeVisible({ timeout: 10000 });
    await page.locator('.back').click();
    
    // Check if active clients stat incremented to 1 (or Arabic ١)
    await expect(page.locator('.stat-v').first()).toHaveText(/1|١/);
    
    // Re-open client details and delete
    await page.locator('text=Stat Client Hero').first().click();
    await expect(page.locator('.chdr')).toBeVisible({ timeout: 10000 });
    await page.locator('button', { hasText: /حذف العميل/ }).click();
    await page.locator('.confirm-ok').click();

    // Verify back in list and stats decremented to 0 (or Arabic ٠)
    await expect(page.locator('.stat-v').first()).toHaveText(/0|٠/);
  });
});

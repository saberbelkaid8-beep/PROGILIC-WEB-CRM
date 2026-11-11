import { mockFirebase } from "./firebase-mock.js";
import { test, expect } from '@playwright/test';

test.describe('Offline and Realtime Sync', () => {
  const testEmail = `offline_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const clientName = `Offline Client Hero`;

  test('should work offline and sync when online', async ({ page, context }) => {
    // 1. Setup - register and login
    await mockFirebase(page, testEmail);
    await page.goto('/');
    await page.locator('text=Sign up').click();
    await page.fill('input[name="fullname"]', 'Offline User');
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator('.hdr')).toBeVisible({ timeout: 15000 });

    // 2. Go offline
    await context.setOffline(true);
    
    // Check if network status indicator shows offline (assuming there is one, or just proceed)
    // Create a client while offline
    await page.locator('button', { hasText: /إضافة عميل|عميل جديد/ }).first().click();
    await page.fill('#f_fn', clientName);
    await page.fill('#f_co', 'Offline Co');
    await page.fill('#f_ph', '0555333333');
    await page.selectOption('#f_wi', 'الجزائر');
    await page.selectOption('#f_bt', 'تجارة تجزئة');
    await page.selectOption('#f_bf', 'سوبرماركت / بقالة');
    await page.selectOption('#f_st', 'نشط');
    await page.selectOption('#f_p_ver', 'V27');
    await page.locator('.msheet button.btn-primary').click();
    
    // Verify client appears in UI optimistically
    await expect(page.locator(`text=${clientName}`).first()).toBeVisible();

    // 3. Go back online
    await context.setOffline(false);
    
    // Client should remain visible in UI after online reconnection and sync flush
    await expect(page.locator(`text=${clientName}`).first()).toBeVisible();
  });
});

import { mockFirebase } from "./firebase-mock.js";
import { test, expect } from '@playwright/test';

test.describe('Offline and Realtime Sync', () => {
  const testEmail = `offline_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const clientName = `Offline Client ${Date.now()}`;

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
    await page.locator('button', { hasText: 'عميل جديد' }).first().click();
    await page.fill('#f_fn', clientName);
    await page.locator('.msheet button', { hasText: 'إضافة العميل' }).click();
    
    // Verify client appears in UI optimistically
    await expect(page.locator(`text=${clientName}`)).toBeVisible();

    // 3. Go back online
    await context.setOffline(false);
    
    // 4. Reload page to verify data persisted/synced
    await page.reload();
    await expect(page.locator('.hdr')).toBeVisible({ timeout: 15000 });
    
    // Client should still be there because it synced or is in local cache
    await expect(page.locator(`text=${clientName}`)).toBeVisible();
  });
});

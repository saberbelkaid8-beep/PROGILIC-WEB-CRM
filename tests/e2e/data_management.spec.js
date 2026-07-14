import { mockFirebase } from "./firebase-mock.js";
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Data Management', () => {
  const testEmail = `data_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  test.beforeEach(async ({ page }) => {
    await mockFirebase(page, testEmail);
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    await page.goto('/');
    await page.locator('text=Sign up').click();
    await page.fill('input[name="fullname"]', 'Data User');
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator('.hdr')).toBeVisible({ timeout: 15000 });
  });

  test('should export data to JSON', async ({ page }) => {
    // Setup download listener
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button', { hasText: 'تصدير JSON' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('crm-backup');
  });

  test('should import data from JSON', async ({ page }) => {
    // Handle dialog
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // Create a mock backup file
    const mockData = {
      clients: [{ id: 999, fullName: 'Imported Client', status: 'نشط', programs: [], issues: [], requirements: [], contactHistory: [] }],
      stats: { totalClients: 1 }
    };
    
    // We can use page.evaluate to mock the file upload or just use Playwright's file chooser
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('label', { hasText: 'استيراد' }).click()
    ]);
    
    const buffer = Buffer.from(JSON.stringify(mockData));
    await fileChooser.setFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer
    });
    
    // Verify client is imported
    await expect(page.locator('text=Imported Client')).toBeVisible();
  });
});

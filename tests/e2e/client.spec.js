import { mockFirebase } from "./firebase-mock.js";
import { test, expect } from '@playwright/test';

test.describe('Client Management', () => {
  const testEmail = `client_test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const clientName = `Acme Corp ${Date.now()}`;
  const editedClientName = `${clientName} - Edited`;

  test.beforeEach(async ({ page }) => {
    await mockFirebase(page, testEmail);
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    // Register and login before each test
    await page.goto('/');
    await page.locator('text=Sign up').click();
    await page.fill('input[name="fullname"]', 'Client Manager');
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    
    // Wait for Dashboard to load
    await expect(page.locator('.hdr')).toBeVisible({ timeout: 15000 });
  });

  test('should create, edit and delete a client', async ({ page }) => {
    // --- 1. Create Client ---
    await page.locator('button', { hasText: '+ عميل جديد' }).click(); // 'Add Client' button
    await expect(page.locator('.msheet')).toBeVisible();

    await page.fill('#f_fn', clientName); // Full name
    await page.fill('#f_ph', '0555123456'); // Phone
    await page.selectOption('#f_wi', 'الجزائر'); // Wilaya
    await page.selectOption('#f_st', 'نشط'); // Status: Active

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.msheet button')).find(b => b.textContent.includes('إضافة العميل'));
      if (btn) btn.click();
      else console.error("Could not find 'إضافة العميل' button inside .msheet!");
    });
    
    // Verify client appears in the list
    await expect(page.locator(`text=${clientName}`)).toBeVisible();

    // --- 2. Edit Client ---
    // Click on the client row to go to details
    await page.locator(`text=${clientName}`).click();
    await expect(page.locator('.chdr')).toBeVisible();

    // Click Edit button
    await page.locator('button', { hasText: 'تعديل' }).click(); // 'Edit' button
    await expect(page.locator('.msheet')).toBeVisible();

    await page.fill('#f_fn', editedClientName);
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.msheet button')).find(b => b.textContent.includes('حفظ التغييرات'));
      if (btn) btn.click();
      else console.error("Could not find 'حفظ التغييرات' button inside .msheet!");
    });

    // Verify name changed in details view
    await expect(page.locator('.chdr')).toContainText(editedClientName);
    
    // --- 3. Delete Client ---
    page.on('dialog', dialog => dialog.accept()); // Accept confirm dialog
    await page.locator('button', { hasText: 'حذف العميل' }).click(); // 'Delete Client'

    // Verify returning to list and client is deleted
    await expect(page.locator('div.hdr')).toBeVisible();
    await expect(page.locator(`text=${editedClientName}`)).toBeHidden();
  });
});

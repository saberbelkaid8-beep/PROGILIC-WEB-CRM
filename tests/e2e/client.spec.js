import { mockFirebase } from "./firebase-mock.js";
import { test, expect } from '@playwright/test';

test.describe('Client Management', () => {
  const testEmail = `client_test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const clientName = `Acme Corp Alpha`;
  const editedClientName = `Acme Corp Alpha Edited`;

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
    await page.locator('button', { hasText: /إضافة عميل|عميل جديد/ }).first().click(); // 'Add Client' button
    await expect(page.locator('.msheet')).toBeVisible();

    await page.fill('#f_fn', clientName); // Full name
    await page.fill('#f_co', 'Acme Enterprise'); // Company
    await page.fill('#f_ph', '0555123456'); // Phone
    await page.selectOption('#f_wi', 'الجزائر'); // Wilaya
    await page.selectOption('#f_bt', 'تجارة تجزئة'); // Business type
    await page.selectOption('#f_bf', 'سوبرماركت / بقالة'); // Field
    await page.selectOption('#f_st', 'نشط'); // Status: Active
    await page.selectOption('#f_p_ver', 'V27'); // Program version

    await page.locator('.msheet button.btn-primary').click();
    
    // Verify client appears in details or list view
    await expect(page.locator('.chdr')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.ch-name')).toContainText(clientName);

    // --- 2. Edit Client ---
    // In details view, click Edit button
    await page.locator('button', { hasText: 'تعديل' }).click(); // 'Edit' button
    await expect(page.locator('.msheet')).toBeVisible();

    await page.fill('#f_fn', editedClientName);
    
    await page.locator('.msheet button.btn-primary').click();

    // Verify name changed in details view
    await expect(page.locator('.chdr')).toContainText(editedClientName);
    
    // --- 3. Delete Client ---
    await page.locator('button', { hasText: /حذف العميل/ }).click(); // 'Delete Client'
    await page.locator('.confirm-ok').click(); // Custom confirm modal OK button

    // Verify returning to list and client is deleted
    await expect(page.locator('div.hdr')).toBeVisible();
    await expect(page.locator(`text=${editedClientName}`)).toBeHidden();
  });
});

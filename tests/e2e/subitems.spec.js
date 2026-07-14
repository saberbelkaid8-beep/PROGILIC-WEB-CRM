import { mockFirebase } from "./firebase-mock.js";
import { test, expect } from '@playwright/test';

test.describe('Client Sub-items Management', () => {
  const testEmail = `subitems_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const clientName = `Target Client ${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await mockFirebase(page, testEmail);
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    // Register and login
    await page.goto('/');
    await page.locator('text=Sign up').click();
    await page.fill('input[name="fullname"]', 'Subitems Manager');
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator('.hdr')).toBeVisible({ timeout: 15000 });

    // Create a target client
    await page.locator('button', { hasText: 'عميل جديد' }).first().click();
    await page.fill('#f_fn', clientName);
    await page.locator('.msheet button', { hasText: 'إضافة العميل' }).click();
    await expect(page.locator(`text=${clientName}`)).toBeVisible();

    // Navigate to client details
    await page.locator(`text=${clientName}`).click();
    await expect(page.locator('.chdr')).toBeVisible();
  });

  test('should create Program, Issue, Requirement, and Contact', async ({ page }) => {
    // --- Create Program ---
    await page.locator('button', { hasText: 'البرامج' }).first().click();
    await page.locator('button', { hasText: 'برنامج جديد' }).first().click();
    await expect(page.locator('.msheet')).toBeVisible();
    await page.fill('#fp_nm', 'Test Program 1');
    await page.locator('button', { hasText: 'إضافة البرنامج' }).click();
    await expect(page.locator('text=Test Program 1')).toBeVisible();

    // --- Create Issue ---
    // Switch to issues tab
    await page.locator('button', { hasText: 'المشاكل' }).first().click();
    await page.locator('button', { hasText: 'مشكلة جديدة' }).first().click();
    await expect(page.locator('.msheet')).toBeVisible();
    await page.fill('#fi_t', 'Test Issue 1');
    await page.locator('button', { hasText: 'تسجيل المشكلة' }).click();
    await expect(page.locator('text=Test Issue 1')).toBeVisible();

    // --- Create Requirement ---
    // Switch to requirements tab
    await page.locator('button', { hasText: 'المتطلبات' }).first().click();
    await page.locator('button', { hasText: 'طلب جديد' }).first().click();
    await expect(page.locator('.msheet')).toBeVisible();
    await page.fill('#fr_t', 'Test Requirement 1');
    await page.locator('button', { hasText: 'تسجيل الطلب' }).click();
    await expect(page.locator('text=Test Requirement 1')).toBeVisible();

    // --- Create Contact ---
    // Switch to contact history tab
    await page.locator('button', { hasText: 'التواصل' }).first().click();
    await page.locator('button', { hasText: 'تسجيل تواصل' }).first().click();
    await expect(page.locator('.msheet')).toBeVisible();
    
    // Set date to today using JS to bypass native date picker weirdness in some browsers
    await page.evaluate(() => {
        document.getElementById('fch_d').value = new Date().toISOString().split('T')[0];
    });
    
    await page.fill('#fch_n', 'Test Contact Note');
    await page.locator('button', { hasText: 'حفظ السجل' }).click();
    await expect(page.locator('text=Test Contact Note')).toBeVisible();
  });
});

import { mockFirebase } from "./firebase-mock.js";
import { test, expect } from '@playwright/test';

test.describe('Search and Filters', () => {
  const testEmail = `search_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const clientName1 = `Alpha Client ${Date.now()}`;
  const clientName2 = `Beta Client ${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await mockFirebase(page, testEmail);
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    await page.goto('/');
    await page.locator('text=Sign up').click();
    await page.fill('input[name="fullname"]', 'Search User');
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator('.hdr')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15000 });

    // Create client 1
    await page.locator('button', { hasText: 'عميل جديد' }).first().click();
    await page.fill('#f_fn', clientName1);
    await page.selectOption('#f_wi', 'الجزائر');
    await page.locator('.msheet button', { hasText: 'إضافة العميل' }).click();

    // Create client 2
    await page.locator('button', { hasText: 'عميل جديد' }).first().click();
    await page.fill('#f_fn', clientName2);
    await page.selectOption('#f_wi', 'وهران');
    await page.locator('.msheet button', { hasText: 'إضافة العميل' }).click();

    await expect(page.locator(`text=${clientName1}`)).toBeVisible();
    await expect(page.locator(`text=${clientName2}`)).toBeVisible();
  });

  test('should filter clients by search query', async ({ page }) => {
    // Search for Alpha
    await page.fill('.search-input', 'Alpha Client');
    
    // Check results
    await expect(page.locator(`text=${clientName1}`)).toBeVisible();
    await expect(page.locator(`text=${clientName2}`)).toBeHidden();

    // Search for Beta
    await page.fill('.search-input', 'Beta Client');
    await expect(page.locator(`text=${clientName1}`)).toBeHidden();
    await expect(page.locator(`text=${clientName2}`)).toBeVisible();
    
    // Clear search
    await page.fill('.search-input', '');
  });

  test('should filter clients by wilaya using advanced filters', async ({ page }) => {
    // Open advanced filters
    await page.locator('button', { hasText: 'فلترة' }).first().click();
    
    // Select wilaya
    await page.locator('.adf-group:has-text("الولاية") select').selectOption('وهران');
    
    // Check results
    await expect(page.locator(`text=${clientName1}`)).toBeHidden();
    await expect(page.locator(`text=${clientName2}`)).toBeVisible();

    // Clear filters
    await page.locator('button', { hasText: 'مسح الفلاتر' }).click();
    await expect(page.locator(`text=${clientName1}`)).toBeVisible();
    await expect(page.locator(`text=${clientName2}`)).toBeVisible();
  });
});

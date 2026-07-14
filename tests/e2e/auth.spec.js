import { mockFirebase } from "./firebase-mock.js";
import { test, expect } from '@playwright/test';

test.describe('Authentication & Session Persistence', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Test User';

  test.beforeEach(async ({ page }) => {
    await mockFirebase(page, testEmail);
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  });

  test('should register a new user', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=Sign up').click();
    await page.fill('input[name="fullname"]', testName);
    await page.fill('input[name="username"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator('.hdr')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=PROGILIC')).toBeVisible();
  });

  test('should logout the user', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=Sign up').click();
    await page.fill('input[name="fullname"]', testName + '2');
    await page.fill('input[name="username"]', '2' + testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator('.hdr')).toBeVisible({ timeout: 15000 });

    page.on('dialog', dialog => dialog.accept());
    await page.locator('button', { hasText: 'خروج' }).click();
    await expect(page.locator('.auth-wrapper')).toBeVisible();
  });

  test('should login an existing user and persist session', async ({ page, context }) => {
    const specificEmail = `login_${Date.now()}@example.com`;
    await page.goto('/');
    await page.locator('text=Sign up').click();
    await page.fill('input[name="fullname"]', 'Login User');
    await page.fill('input[name="username"]', specificEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator('.hdr')).toBeVisible({ timeout: 15000 });
    
    page.on('dialog', dialog => dialog.accept());
    await page.locator('button', { hasText: 'خروج' }).click();
    await expect(page.locator('.auth-wrapper')).toBeVisible();

    await page.locator('text=Log in').click();
    await page.fill('input[name="username"]', specificEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.hdr')).toBeVisible({ timeout: 15000 });

    const newPage = await context.newPage();
    await mockFirebase(newPage, specificEmail);
    await newPage.goto('/');
    await expect(newPage.locator('.hdr')).toBeVisible({ timeout: 15000 });
  });
});

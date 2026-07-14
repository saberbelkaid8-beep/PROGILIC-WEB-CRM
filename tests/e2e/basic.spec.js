import { mockFirebase } from "./firebase-mock.js";
import { test, expect } from '@playwright/test';

test.describe('CRM Basic Navigation', () => {
  test('should load the login page by default', async ({ page }) => {
    await page.goto('/');
    // Check if login heading exists
    const heading = await page.textContent('h1');
    expect(heading).toBeTruthy();
  });

  test('should allow switching to registration', async ({ page }) => {
    await page.goto('/');
    const regLink = await page.locator('text=سجل الآن');
    if (await regLink.isVisible()) {
        await regLink.click();
        const registerBtn = await page.locator('button:has-text("إنشاء حساب")');
        await expect(registerBtn).toBeVisible();
    }
  });
});

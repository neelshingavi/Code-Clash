import { test, expect } from '@playwright/test';

test.describe('Code Clash E2E Smoke Test', () => {
  const username = `usr_${Math.floor(Date.now() / 1000)}`;
  const leetcodeId = 'neelshingavi';
  
  test('User can register, create challenge, and submit solution', async ({ page }) => {
    // 1. Register User A
    await page.goto('/auth');
    await page.click('text=Need an account? Register');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', `${username}@gmail.com`);
    await page.fill('input[name="leetcodeId"]', leetcodeId);
    await page.fill('input[name="password"]', 'Password@123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/');
    
    // 2. Create Challenge
    await page.click('text=New Challenge');
    await expect(page).toHaveURL('/challenges/create');
    await page.fill('input[name="name"]', 'Smoke Test Challenge');
    
    // Fill dates (today to +5 days)
    const today = new Date().toISOString().split('T')[0];
    const end = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    
    await page.fill('input[name="startDate"]', today);
    await page.fill('input[name="endDate"]', end);
    await page.fill('input[name="dailyTarget"]', '5');
    await page.fill('input[name="easyPoints"]', '1');
    await page.click('button[type="submit"]');

    // Wait for redirect to challenge arena
    await expect(page.url()).toContain('/challenges/');
    
    // 3. Submit Solution
    await page.goto('/submit');
    await page.selectOption('select[name="challengeId"]', { label: 'Smoke Test Challenge' });
    await page.fill('input[name="problemUrl"]', 'https://leetcode.com/problems/two-sum');
    await page.fill('input[name="problemName"]', 'Two Sum');
    await page.selectOption('select[name="difficulty"]', 'easy');
    
    await page.click('button[type="submit"]');

    // Verify success message
    await expect(page.locator('text=Submission verified and logged!')).toBeVisible({ timeout: 10000 });
    
    // 4. Verify score on dashboard
    await page.goto('/');
    // Score should be 1 (since Two Sum is easy and easy_points=1)
    await expect(page.locator('text=Your Score: 1')).toBeVisible();
  });
});

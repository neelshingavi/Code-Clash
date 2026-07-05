# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Code Clash E2E Smoke Test >> User can register, create challenge, and submit solution
- Location: e2e/smoke.spec.ts:7:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected: "http://localhost:3000/"
Received: "http://localhost:3000/auth"
Timeout:  5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × unexpected value "http://localhost:3000/auth"

```

```yaml
- banner:
  - link "Code Clash":
    - /url: /
    - heading "Code Clash" [level=1]
  - navigation:
    - link "Dashboard":
      - /url: /
    - link "Activity Feed":
      - /url: /activity
    - link "Discover":
      - /url: /challenges
    - link "Log Problem":
      - /url: /submit
    - link "Settings":
      - /url: /settings
  - navigation:
    - link "Dashboard":
      - /url: /
    - link "Activity Feed":
      - /url: /activity
    - link "Discover":
      - /url: /challenges
    - link "Log Problem":
      - /url: /submit
    - link "Settings":
      - /url: /settings
- main:
  - heading "Join the Arena" [level=2]
  - text: Email
  - textbox: usr_1783202460@gmail.com
  - text: Username (Display Name)
  - textbox "3-20 characters, alphanumeric and underscores only.": usr_1783202460
  - text: LeetCode ID (Handle)
  - textbox: neelshingavi
  - text: Password
  - textbox: Password@123
  - button "Register Account"
  - button "Already have an account? Login"
- status
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Code Clash E2E Smoke Test', () => {
  4  |   const username = `usr_${Math.floor(Date.now() / 1000)}`;
  5  |   const leetcodeId = 'neelshingavi';
  6  |   
  7  |   test('User can register, create challenge, and submit solution', async ({ page }) => {
  8  |     // 1. Register User A
  9  |     await page.goto('/auth');
  10 |     await page.click('text=Need an account? Register');
  11 |     await page.fill('input[name="username"]', username);
  12 |     await page.fill('input[name="email"]', `${username}@gmail.com`);
  13 |     await page.fill('input[name="leetcodeId"]', leetcodeId);
  14 |     await page.fill('input[name="password"]', 'Password@123');
  15 |     await page.click('button[type="submit"]');
  16 | 
  17 |     // Wait for redirect to dashboard
> 18 |     await expect(page).toHaveURL('/');
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  19 |     
  20 |     // 2. Create Challenge
  21 |     await page.click('text=New Challenge');
  22 |     await expect(page).toHaveURL('/challenges/create');
  23 |     await page.fill('input[name="name"]', 'Smoke Test Challenge');
  24 |     
  25 |     // Fill dates (today to +5 days)
  26 |     const today = new Date().toISOString().split('T')[0];
  27 |     const end = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
  28 |     
  29 |     await page.fill('input[name="startDate"]', today);
  30 |     await page.fill('input[name="endDate"]', end);
  31 |     await page.fill('input[name="dailyTarget"]', '5');
  32 |     await page.fill('input[name="easyPoints"]', '1');
  33 |     await page.click('button[type="submit"]');
  34 | 
  35 |     // Wait for redirect to challenge arena
  36 |     await expect(page.url()).toContain('/challenges/');
  37 |     
  38 |     // 3. Submit Solution
  39 |     await page.goto('/submit');
  40 |     await page.selectOption('select[name="challengeId"]', { label: 'Smoke Test Challenge' });
  41 |     await page.fill('input[name="problemUrl"]', 'https://leetcode.com/problems/two-sum');
  42 |     await page.fill('input[name="problemName"]', 'Two Sum');
  43 |     await page.selectOption('select[name="difficulty"]', 'easy');
  44 |     
  45 |     await page.click('button[type="submit"]');
  46 | 
  47 |     // Verify success message
  48 |     await expect(page.locator('text=Submission verified and logged!')).toBeVisible({ timeout: 10000 });
  49 |     
  50 |     // 4. Verify score on dashboard
  51 |     await page.goto('/');
  52 |     // Score should be 1 (since Two Sum is easy and easy_points=1)
  53 |     await expect(page.locator('text=Your Score: 1')).toBeVisible();
  54 |   });
  55 | });
  56 | 
```
<div align="center">

# ⚔️ Code Clash: The Ultimate Developer Arena ⚔️

**Stop tracking. Start competing.**  
*A production-grade, real-time multiplayer coding competition engine built for you and your rivals.*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-DB_%26_Auth-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

---

## 🌟 Welcome to the Arena

Code Clash isn't just a daily habit tracker—it's a **ruthless, gamified challenge engine** designed to force you to become a better programmer. Connect your LeetCode ID, forge time-bound challenges with your friends, and watch their scores update in real-time as you race to solve algorithmic problems.

Miss your daily quota? Prepare to face the consequences. Our dynamic penalty engine will double your required points, slash your score, or strip your rank. Only the strongest survive.

---

## 🔥 Core Arsenal (Features)

*   ⏱️ **Time-Bound Forges (Challenges):** Spin up 1-week sprints, 1-month marathons, or infinite grinds. You set the rules; the Arena enforces them.
*   ⚡ **Supabase Realtime Leaderboards:** WebSocket integration means the second your rival solves a problem, your dashboard updates with a flash. No refreshing. Pure adrenaline.
*   💀 **The Penalty Engine:** Miss your daily target? Choose your poison:
    *   **Minus Points:** Direct deduction from your score.
    *   **The Double-Up:** Missed today? Tomorrow you must solve *twice* as many problems just to break even.
    *   **Rank Demotion:** Fall from Diamond down to Platinum.
*   🎨 **Premium Dark-Mode Aesthetics:** Hand-crafted, bespoke glassmorphism built entirely with Vanilla CSS. No generic UI libraries. Pure, unadulterated style.
*   🔐 **LeetCode Identity Integration:** Securely bind your LeetCode handle to your profile during the Supabase Auth flow.

---

## 🏗️ Architecture

Code Clash is built for speed, scalability, and zero-latency updates:

*   **Frontend:** Next.js (App Router), React, Lucide Icons.
*   **Styling:** Bespoke Vanilla CSS with CSS Variables for dynamic theming.
*   **Backend & Auth:** Supabase (PostgreSQL, Row Level Security, Realtime Subscriptions).
*   **Logic:** A custom, client-side zero-error **Penalty Engine** that evaluates historical timestamps on-the-fly to enforce rules.

---

## 🚀 Getting Started

Ready to enter the Arena? Set up your local environment in 3 simple steps:

### 1. Database Initialization
1. Create a project on [Supabase](https://supabase.com).
2. Navigate to the SQL Editor and run the provided `schema.sql` and `schema_v2.sql` scripts to generate the advanced relational tables and security policies.

### 2. Environment Variables
Create a `.env.local` file in the root directory and forge your keys:
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Ignite the Engine
```bash
npm install
npm run dev
```
Navigate to `http://localhost:3000`, register your LeetCode ID, and forge your first Challenge.

---

<div align="center">
<i>"The master has failed more times than the beginner has even tried."</i><br>
<b>Start coding. Destroy your rivals.</b>
</div>

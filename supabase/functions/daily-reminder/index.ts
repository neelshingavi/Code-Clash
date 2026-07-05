import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const today = new Date().toISOString().split('T')[0];

    // Find all users who have an active challenge but haven't met their quota today
    // This is a simplified query; in production, you'd match the exact logic from run_daily_penalty_sweep
    const { data: usersAtRisk, error } = await supabase.rpc('get_users_missing_quota_today', { p_date: today });

    if (error) throw error;

    if (!usersAtRisk || usersAtRisk.length === 0) {
      return new Response(JSON.stringify({ message: "No users at risk today." }), { status: 200 });
    }

    const emails = usersAtRisk.map((u: any) => ({
      from: 'Code Clash <reminders@codeclash.dev>',
      to: [u.email],
      subject: 'Warning: 2 hours left to save your streak!',
      html: `<h2>Don't lose your streak!</h2><p>Hi ${u.username},</p><p>You have 2 hours left to complete your daily LeetCode target and save your score in Code Clash.</p><p><a href="https://codeclash.dev/submit">Submit a problem now</a></p>`
    }));

    // Send via Resend Batch API
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emails)
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Resend API error: ${errTxt}`);
    }

    return new Response(JSON.stringify({ success: true, count: emails.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

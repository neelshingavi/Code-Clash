const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
supabase.auth.signUp({
  email: 'e2e_test@codeclash.dev',
  password: 'Password@123',
  options: { data: { username: 'e2e_tester', leetcode_id: 'neelshingavi' } }
}).then(console.log).catch(console.error);

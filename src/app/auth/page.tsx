import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AuthClient from './AuthClient';

export default async function AuthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    redirect('/');
  }
  
  return <AuthClient />;
}

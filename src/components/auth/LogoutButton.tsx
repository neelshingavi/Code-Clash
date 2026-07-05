'use client';

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/auth");
  };

  return (
    <button
      onClick={handleLogout}
      className="btn btn-danger btn-sm"
      style={{
        gap: '0.375rem',
      }}
    >
      <LogOut size={15} />
      Logout
    </button>
  );
}

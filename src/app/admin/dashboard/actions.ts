"use server";

import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(adminPath("/login"));
}

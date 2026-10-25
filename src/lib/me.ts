import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export async function fetchMe() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*, units(*)").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  return { user, profile, isStaff: !!roles?.some((r) => r.role === "staff") };
}

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: fetchMe });

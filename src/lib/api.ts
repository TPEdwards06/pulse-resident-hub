import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "./me";

// RPCs added in 0001_security_hardening.sql aren't in the generated types yet.
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

export type FeedItem = {
  delivery_id: string;
  message_id: string;
  title: string;
  body: string;
  category: string;
  priority: "normal" | "urgent";
  requires_ack: boolean;
  is_personal: boolean;
  scheduled_at: string;
  seen_at: string | null;
  acked_at: string | null;
};

// "Done" = the checkbox in the mockup is ticked.
export const isDone = (m: FeedItem) => (m.requires_ack ? !!m.acked_at : !!m.seen_at);

export const useFeed = () =>
  useQuery({ queryKey: ["feed"], queryFn: () => rpc<FeedItem[]>("my_feed") });

export function useFeedActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["feed"] });
  return {
    seen: useMutation({ mutationFn: (id: string) => rpc("mark_seen", { _delivery_id: id }), onSuccess: refresh }),
    ack: useMutation({ mutationFn: (id: string) => rpc("ack_message", { _delivery_id: id }), onSuccess: refresh }),
  };
}

export function useMyCharges() {
  const { data: me } = useMe();
  const pid = me?.profile?.id;
  return useQuery({
    queryKey: ["charges", pid],
    enabled: !!pid,
    queryFn: () =>
      must(supabase.from("charges").select("*").eq("resident_id", pid!).order("due_date", { ascending: true })),
  });
}

export function useMyPackages() {
  const { data: me } = useMe();
  const pid = me?.profile?.id;
  return useQuery({
    queryKey: ["packages", pid],
    enabled: !!pid,
    queryFn: () =>
      must(supabase.from("packages").select("*").eq("resident_id", pid!).order("arrived_at", { ascending: false })),
  });
}

export function useMyOffer() {
  const { data: me } = useMe();
  const pid = me?.profile?.id;
  return useQuery({
    queryKey: ["offer", pid],
    enabled: !!pid,
    queryFn: () => must(supabase.from("renewal_offers").select("*").eq("resident_id", pid!).maybeSingle()),
  });
}

export const offerChanged = (o: { offer_rent: number; previous_offer_rent: number | null } | null | undefined) =>
  !!o && o.previous_offer_rent != null && Number(o.previous_offer_rent) !== Number(o.offer_rent);

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

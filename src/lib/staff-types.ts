export type MsgStat = {
  id: string; title: string; category: string; priority: string; requires_ack: boolean; audience_label: string | null;
  scheduled_at: string; parent_message_id: string | null; is_personal: boolean; delivered: number; seen: number; acked: number;
};
export type RenewalRow = {
  resident_id: string; full_name: string; unit_number: string; lease_end: string | null; renewal_status: "undecided" | "renewing" | "not_renewing";
  current_rent: number | null; offer_rent: number | null; previous_offer_rent: number | null; offer_expires: string | null;
  renewal_notices: number; renewal_notices_seen: number; last_seen: string | null;
};

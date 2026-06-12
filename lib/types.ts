export type Role = "jockey" | "trainer" | "owner" | "agent" | "admin";

export interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: Role;
  phone: string | null;
  phone_normalized: string | null;
  country: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  verified: boolean;
  verification_status: "pending" | "approved" | "rejected";
  status: string;
  registry_match: boolean;
  licence_type: string | null;
  apprentice: boolean;
  apprentice_claim: number | null;
  riding_weight: number | null;
  apprentice_riding_weight: number | null;
  base_region: string | null;
  preferred_tracks: string | null;
  availability_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  nztr_day_id: number | null;
  meeting_date: string;
  track: string;
  club: string | null;
  source: string | null;
  meeting_type: string | null;
}

export interface PublicAttendance {
  meeting_id: string;
  jockey_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  profile_photo_url: string | null;
  riding_weight: number | null;
  apprentice_claim: number | null;
  apprentice: boolean;
  availability: string | null;
}

export interface RideRequest {
  id: string;
  meeting_id: string | null;
  race_id: string | null;
  trainer_id: string;
  jockey_id: string;
  horse_name: string | null;
  race_number: number | null;
  note: string | null;
  status: "requested" | "accepted" | "declined" | "cancelled" | "assigned";
  created_by: string;
  created_at: string;
}

export interface ChatThread {
  id: string;
  type: "direct" | "ride" | "meeting_group";
  meeting_id: string | null;
  ride_request_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
}

export interface Subscription {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  status: string | null;
  trial_end: string | null;
  current_period_end: string | null;
}

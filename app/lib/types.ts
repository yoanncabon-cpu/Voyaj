// Types des données lues depuis Supabase (noms de colonnes en snake_case).

export interface PriceBreakdown {
  distanceKm: number;
  fuelCostEur: number;
  wearCostEur: number;
  totalCostEur: number;
  passengerShareEur: number;
  voyajFeeEur: number;
  passengerTotalEur: number;
  driverEarningsEur: number;
}

export type RideStatus =
  | 'awaiting_payment' | 'searching' | 'accepted' | 'pickup' | 'in_progress'
  | 'ended' | 'confirmed' | 'cancelled' | 'passenger_absent' | 'expired';

export interface Ride {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  status: RideStatus;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dest_lat: number;
  dest_lng: number;
  dest_address: string;
  distance_km: number;
  price: PriceBreakdown;
  vehicle_description: string | null;
  has_dispute: boolean;
  created_at: string;
  searching_at: string | null;
  accepted_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  rating: number;
  ratings_count: number;
  rides_count: number;
  points_balance: number;
  is_verified: boolean;
  verification_status: 'none' | 'pending' | 'verified' | 'rejected';
  is_driver: boolean;
  is_suspended: boolean;
  is_admin: boolean;
  stripe_account_id: string | null;
  stripe_payouts_enabled: boolean;
  terms_accepted_at: string | null;
  created_at: string;
}

export interface PublicProfile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  rating: number;
  ratings_count: number;
  rides_count: number;
  is_verified: boolean;
  is_driver: boolean;
  created_at: string;
}

export interface Vehicle {
  owner_id: string;
  make: string;
  model: string;
  plate: string;
  color: string | null;
  vehicle_type: 'citadine' | 'berline' | 'suv' | 'break' | 'utilitaire';
  seats: number;
  locked: boolean;
}

export interface ScheduledRide {
  id: string;
  driver_id: string;
  origin_address: string;
  dest_address: string;
  departure_at: string;
  seats: number;
  booked_seats: number;
  distance_km: number;
  price: PriceBreakdown;
  recurring_daily: boolean;
  status: 'published' | 'full' | 'completed' | 'cancelled';
}

export interface Booking {
  id: string;
  scheduled_ride_id: string;
  passenger_id: string;
  seats: number;
  amount_eur: number;
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
  penalty_eur: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_a: string;
  user_b: string;
  last_message: string | null;
  last_message_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string | null;
  points_cost: number;
  icon: string | null;
}

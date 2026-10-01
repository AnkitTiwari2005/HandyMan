export type UserRole = 'customer' | 'technician' | 'admin';

export type KycStatus = 'pending' | 'approved' | 'rejected';

export type BookingStatus = 
  | 'confirmed'     // Placed by customer, pending partner claim
  | 'assigned'      // Direct dispatch
  | 'accepted'      // Claimed by technician, preparing to head out
  | 'on_the_way'    // Technician in transit
  | 'in_progress'   // Start OTP verified, service underway
  | 'completed'     // Service finished, proof uploaded, payment settled
  | 'cancelled';

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface TechnicianProfile {
  id: string;
  skills: string[];
  experience_years: number;
  id_type: string;
  id_number?: string;
  id_document_url?: string;
  verification_status: KycStatus;
  rejection_reason?: string;
  is_online: boolean;
  current_latitude?: number | null;
  current_longitude?: number | null;
  service_radius_km: number;
  pincodes_served: string[];
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_upi_id?: string;
  wallet_balance: number;
  total_completed_jobs: number;
  rating: number;
  total_ratings_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface BookingAddressSnapshot {
  label?: string;
  flat_number?: string;
  building_name?: string;
  street?: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  full_address?: string;
  latitude?: number;
  longitude?: number;
}

export interface BookingItem {
  id: string;
  booking_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  services?: {
    name: string;
    image_url?: string;
    category?: string;
  };
}

export interface Booking {
  id: string;
  booking_ref: string;
  customer_id: string;
  service_id: string;
  technician_id?: string | null;
  status: BookingStatus;
  scheduled_date: string;
  scheduled_time: string;
  address_id?: string;
  address_snapshot?: BookingAddressSnapshot;
  special_instructions?: string;
  subtotal: number;
  platform_fee: number;
  gst_amount: number;
  total_amount: number;
  payment_status: 'pending' | 'paid' | 'failed';
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  start_otp?: string;
  started_at?: string;
  completed_at?: string;
  proof_before_url?: string;
  proof_after_url?: string;
  technician_notes?: string;
  technician_earnings?: number;
  created_at: string;
  services?: {
    name: string;
    category: string;
    image_url?: string;
  };
  booking_items?: BookingItem[];
}

export interface PayoutTransaction {
  id: string;
  technician_id: string;
  booking_id?: string;
  type: 'job_payout' | 'incentive' | 'withdrawal' | 'penalty';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  reference_id?: string;
  notes?: string;
  created_at: string;
}

export interface TechnicianReview {
  id: string;
  booking_id: string;
  technician_id: string;
  customer_id: string;
  rating: number;
  feedback?: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'booking' | 'support' | 'promo' | 'info';
  booking_id?: string;
  is_read: boolean;
  created_at: string;
}

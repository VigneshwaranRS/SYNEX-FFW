/**
 * Supabase database type definitions.
 *
 * These types describe the shape of the database tables.
 * For full type safety, run `supabase gen types typescript` after
 * connecting your project and replace this file.
 *
 * Until then, these manually written types provide structure and
 * guide schema creation.
 */

export type PaymentStatus =
  | "not_required"
  | "pending"
  | "submitted_for_review"
  | "verified"
  | "failed"
  | "rejected";

export type RegistrationStatus =
  | "pending"
  | "confirmed"
  | "waitlisted"
  | "cancelled";

export type AffiliationCategory = "internal" | "external";

export type OrganizerRole = "admin" | "checkin_staff";

/** Structured team member with contact details */
export interface TeamMemberRecord {
  name: string;
  email: string;
  phone: string;
}

export interface Database {
  public: {
    Tables: {
      registrations: {
        Row: {
          id: string; // UUID
          reference: string; // public non-sequential reference
          team_name: string | null;
          full_name: string;
          email: string;
          phone: string | null;
          institution: string;
          affiliation: AffiliationCategory;
          department: string | null;
          year_of_study: string | null;
          team_members: TeamMemberRecord[]; // JSONB array of member objects
          consent_given: boolean;
          consent_timestamp: string | null;
          transaction_id: string | null;
          payment_screenshot_url: string | null;
          project_pdf_url: string | null;
          status: RegistrationStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["registrations"]["Row"],
          "id" | "reference" | "created_at" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["registrations"]["Row"]
        >;
      };
      payments: {
        Row: {
          id: string;
          registration_id: string;
          amount: number | null;
          currency: string;
          status: PaymentStatus;
          provider_reference: string | null;
          verified_by: string | null; // organizer auth UID
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["payments"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
      };
      attendance: {
        Row: {
          id: string;
          registration_id: string;
          checked_in_at: string;
          checked_in_by: string; // organizer auth UID
        };
        Insert: Omit<
          Database["public"]["Tables"]["attendance"]["Row"],
          "id" | "checked_in_at"
        >;
        Update: never;
      };
      organizer_profiles: {
        Row: {
          id: string; // auth.users UID
          role: OrganizerRole;
          display_name: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["organizer_profiles"]["Row"],
          "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["organizer_profiles"]["Row"]
        >;
      };
      event_settings: {
        Row: {
          id: string;
          event_date: string | null;
          event_start_time: string | null;
          event_end_time: string | null;
          timezone: string;
          venue_name: string | null;
          venue_address: string | null;
          venue_map_url: string | null;
          tagline: string;
          short_description: string;
          registration_open: boolean;
          registration_deadline: string | null;
          capacity: number | null;
          waitlist_enabled: boolean;
          eligibility_rules: string | null;
          internal_student_fee: number | null;
          external_student_fee: number | null;
          fee_currency: string;
          payment_enabled: boolean;
          payment_instructions: string | null;
          contact_email: string | null;
          privacy_notice: string | null;
          published: boolean;
          updated_by: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["event_settings"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["event_settings"]["Row"]
        >;
      };
      event_sessions: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          start_time: string | null;
          end_time: string | null;
          track: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["event_sessions"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["event_sessions"]["Row"]
        >;
      };
      event_faqs: {
        Row: {
          id: string;
          question: string;
          answer: string;
          display_order: number;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["event_faqs"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["event_faqs"]["Row"]
        >;
      };
      payment_settings: {
        Row: {
          id: string;
          payee_label: string | null;
          payment_instructions: string | null;
          qr_image_path: string | null;
          qr_enabled: boolean;
          applicable_categories: AffiliationCategory[];
          amount_rules: string | null;
          payment_reference_format: string | null;
          enabled: boolean;
          updated_by: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["payment_settings"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["payment_settings"]["Row"]
        >;
      };
      event_settings_audit: {
        Row: {
          id: string;
          actor_id: string;
          actor_email: string | null;
          action: string;
          summary: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["event_settings_audit"]["Row"],
          "id" | "created_at"
        >;
        Update: never;
      };
    };
  };
}

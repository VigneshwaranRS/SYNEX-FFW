import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────────────────
export const MAX_TEAM_MEMBERS = 4;
export const MIN_TEAM_MEMBERS = 1;
export const MAX_INTERNAL_TEAMS = 20;
export const MAX_EXTERNAL_TEAMS = 50;
export const SIMATS_EMAIL_SUFFIX = ".simats@saveetha.com";

// ─── Registration form schema (team-based) ────────────────────────────────────

export const registrationSchema = z.object({
  team_name: z
    .string()
    .trim()
    .min(2, "Team name must be at least 2 characters")
    .max(100, "Team name must be under 100 characters"),

  full_name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be under 100 characters"),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address")
    .max(254, "Email address is too long"),

  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),

  institution: z
    .string()
    .trim()
    .min(2, "Institution name must be at least 2 characters")
    .max(150, "Institution name must be under 150 characters"),

  affiliation: z.enum(["internal", "external"], {
    message: "Please select your affiliation",
  }),

  department: z
    .string()
    .trim()
    .max(100, "Department name must be under 100 characters")
    .optional()
    .or(z.literal("")),

  year_of_study: z
    .string()
    .trim()
    .max(20, "Year of study must be under 20 characters")
    .optional()
    .or(z.literal("")),

  consent_given: z.literal(true, {
    message: "You must agree to the privacy notice to register",
  }),

  team_members: z
    .array(z.string().trim().min(2, "Member name is required (minimum 2 characters)").max(100))
    .max(MAX_TEAM_MEMBERS - 1, `You can add at most ${MAX_TEAM_MEMBERS - 1} additional members`)
    .default([]),
}).refine(
  (data) => {
    // For internal students, validate SIMATS email
    if (data.affiliation === "internal") {
      return data.email.endsWith(SIMATS_EMAIL_SUFFIX);
    }
    return true;
  },
  {
    message: `SIMATS students must use their college email (e.g. 192521307.simats@saveetha.com)`,
    path: ["email"],
  }
);

export type RegistrationFormData = z.infer<typeof registrationSchema>;

// ─── Validation helpers ───────────────────────────────────────────────────

export function validateRegistrationForm(
  data: unknown
): { success: true; data: RegistrationFormData } | { success: false; errors: Record<string, string> } {
  const result = registrationSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as string;
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }
  return { success: false, errors };
}

// ─── Admin event settings schema ─────────────────────────────────────────

export const eventSettingsSchema = z.object({
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .nullable()
    .optional(),

  event_start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format")
    .nullable()
    .optional(),

  event_end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format")
    .nullable()
    .optional(),

  timezone: z.string().min(1).max(64).default("Asia/Kolkata"),

  venue_name: z.string().trim().max(200).nullable().optional(),
  venue_address: z.string().trim().max(500).nullable().optional(),
  venue_map_url: z.string().url("Must be a valid URL").nullable().optional()
    .or(z.literal("").transform(() => null)),

  tagline: z.string().trim().min(1, "Tagline is required").max(200),
  short_description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(2000),

  registration_open: z.boolean().default(false),
  registration_deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Invalid deadline format")
    .nullable()
    .optional(),

  capacity: z.number().int().positive().nullable().optional(),
  waitlist_enabled: z.boolean().default(false),

  eligibility_rules: z.string().trim().max(1000).nullable().optional(),

  internal_student_fee: z.number().min(0).nullable().optional(),
  external_student_fee: z.number().min(0).nullable().optional(),
  fee_currency: z.string().length(3, "Use a 3-letter currency code").default("INR"),

  payment_enabled: z.boolean().default(false),
  payment_instructions: z.string().trim().max(2000).nullable().optional(),

  contact_email: z
    .string()
    .email("Must be a valid email")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),

  privacy_notice: z.string().trim().max(5000).nullable().optional(),
});

export type EventSettingsFormData = z.infer<typeof eventSettingsSchema>;

// ─── Payment settings schema ──────────────────────────────────────────────

export const paymentSettingsSchema = z.object({
  payee_label: z.string().trim().max(200).nullable().optional(),
  payment_instructions: z.string().trim().max(2000).nullable().optional(),
  qr_enabled: z.boolean().default(false),
  applicable_categories: z
    .array(z.enum(["internal", "external"]))
    .default([]),
  amount_rules: z.string().trim().max(500).nullable().optional(),
  payment_reference_format: z.string().trim().max(200).nullable().optional(),
  enabled: z.boolean().default(false),
});

export type PaymentSettingsFormData = z.infer<typeof paymentSettingsSchema>;

// ─── FAQ schema ───────────────────────────────────────────────────────────

export const faqSchema = z.object({
  question: z.string().trim().min(5, "Question too short").max(300),
  answer: z.string().trim().min(5, "Answer too short").max(2000),
  display_order: z.number().int().default(0),
});

// ─── Session schema ───────────────────────────────────────────────────────

export const sessionSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  start_time: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Invalid datetime format")
    .nullable()
    .optional(),
  end_time: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Invalid datetime format")
    .nullable()
    .optional(),
  track: z.string().trim().max(100).nullable().optional(),
  display_order: z.number().int().default(0),
});

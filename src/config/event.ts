/**
 * SYNEX Event Configuration
 *
 * This file provides TYPED DEFAULTS only.
 * At runtime, the public site reads the published event_settings record
 * from the database. These defaults are used for initial setup and as
 * fallback values when the admin has not yet published settings.
 *
 * DO NOT hardcode unconfirmed facts as if they were official.
 * Any field marked UNCONFIRMED must be filled in by the organizer
 * via the Admin → Event Settings panel before launch.
 */

export const EVENT_NAME = "SYNEX";
export const ORGANIZER_NAME = "AI Club";

/**
 * Static defaults — used as initial DB seed and local fallback only.
 * The live site reads from the database; this is NOT the source of truth
 * for a deployed instance.
 */
export const EVENT_DEFAULTS = {
  /** Planned date — verify with organizer before launch */
  eventDate: "2026-11-05" as string | null,
  eventStartTime: null as string | null, // e.g. "09:00"  — UNCONFIRMED
  eventEndTime: null as string | null,   // e.g. "18:00"  — UNCONFIRMED
  timezone: "Asia/Kolkata",

  /** UNCONFIRMED — do not publish until organizer confirms */
  venueName: null as string | null,
  venueAddress: null as string | null,
  venueMapUrl: null as string | null,

  tagline: "The AI Club's flagship technology event.",
  shortDescription:
    "SYNEX is an AI Club event bringing together students to explore, " +
    "build, and discuss emerging technology. Details including tracks, " +
    "workshops, and schedule will be announced once confirmed.",

  /** Registration state — organizer sets this via admin panel */
  registrationOpen: false,
  registrationDeadline: null as string | null, // UNCONFIRMED

  /** Capacity — leave null until organizer decides */
  capacity: null as number | null,
  waitlistEnabled: false,

  /**
   * Eligibility — organizer must supply official wording.
   * Do not fabricate affiliation verification details.
   */
  eligibilityRules: null as string | null, // UNCONFIRMED

  /**
   * Fees — UNCONFIRMED. Do not invent amounts.
   * Internal-student fee may be free after eligibility is verified.
   * External fee is unknown.
   */
  internalStudentFee: null as number | null,   // UNCONFIRMED
  externalStudentFee: null as number | null,   // UNCONFIRMED
  feeCurrency: "INR",

  /** Payment — UNCONFIRMED. Do not display until organizer configures. */
  paymentEnabled: false,
  paymentInstructions: null as string | null,  // UNCONFIRMED

  /** Contact — UNCONFIRMED */
  contactEmail: null as string | null,         // UNCONFIRMED
  privacyNotice: null as string | null,        // organizer must supply

  /** Schedule/program — leave empty until confirmed */
  sessions: [] as EventSession[],

  /** FAQ — only verified answers */
  faqs: [] as FaqEntry[],
} as const satisfies Partial<EventConfig>;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EventConfig {
  eventDate: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  timezone: string;
  venueName: string | null;
  venueAddress: string | null;
  venueMapUrl: string | null;
  tagline: string;
  shortDescription: string;
  registrationOpen: boolean;
  registrationDeadline: string | null;
  capacity: number | null;
  waitlistEnabled: boolean;
  eligibilityRules: string | null;
  internalStudentFee: number | null;
  externalStudentFee: number | null;
  feeCurrency: string;
  paymentEnabled: boolean;
  paymentInstructions: string | null;
  contactEmail: string | null;
  privacyNotice: string | null;
  sessions: EventSession[];
  faqs: FaqEntry[];
}

export interface EventSession {
  id: string;
  title: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  track: string | null;
  displayOrder: number;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
}

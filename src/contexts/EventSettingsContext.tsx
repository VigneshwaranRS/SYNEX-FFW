import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase";
import { EVENT_DEFAULTS } from "../config/event";
import type { EventConfig, EventSession, FaqEntry } from "../config/event";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface EventSettingsContextValue {
  settings: EventConfig;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EventSettingsContext = createContext<EventSettingsContextValue | null>(null);

/**
 * Converts a database event_settings row into our typed EventConfig.
 * Falls back to EVENT_DEFAULTS for any null/missing database fields.
 */
function rowToConfig(row: AnyRow, sessions: EventSession[], faqs: FaqEntry[]): EventConfig {
  return {
    eventDate: row.event_date ?? EVENT_DEFAULTS.eventDate,
    eventStartTime: row.event_start_time ?? EVENT_DEFAULTS.eventStartTime,
    eventEndTime: row.event_end_time ?? EVENT_DEFAULTS.eventEndTime,
    timezone: row.timezone ?? EVENT_DEFAULTS.timezone,
    venueName: row.venue_name ?? EVENT_DEFAULTS.venueName,
    venueAddress: row.venue_address ?? EVENT_DEFAULTS.venueAddress,
    venueMapUrl: row.venue_map_url ?? EVENT_DEFAULTS.venueMapUrl,
    tagline: row.tagline ?? EVENT_DEFAULTS.tagline,
    shortDescription: row.short_description ?? EVENT_DEFAULTS.shortDescription,
    registrationOpen: row.registration_open ?? EVENT_DEFAULTS.registrationOpen,
    registrationDeadline: row.registration_deadline ?? EVENT_DEFAULTS.registrationDeadline,
    capacity: row.capacity ?? EVENT_DEFAULTS.capacity,
    waitlistEnabled: row.waitlist_enabled ?? EVENT_DEFAULTS.waitlistEnabled,
    eligibilityRules: row.eligibility_rules ?? EVENT_DEFAULTS.eligibilityRules,
    internalStudentFee: row.internal_student_fee ?? EVENT_DEFAULTS.internalStudentFee,
    externalStudentFee: row.external_student_fee ?? EVENT_DEFAULTS.externalStudentFee,
    feeCurrency: row.fee_currency ?? EVENT_DEFAULTS.feeCurrency,
    paymentEnabled: row.payment_enabled ?? EVENT_DEFAULTS.paymentEnabled,
    paymentInstructions: row.payment_instructions ?? EVENT_DEFAULTS.paymentInstructions,
    contactEmail: row.contact_email ?? EVENT_DEFAULTS.contactEmail,
    privacyNotice: row.privacy_notice ?? EVENT_DEFAULTS.privacyNotice,
    sessions,
    faqs,
  };
}

export function EventSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<EventConfig>({
    ...EVENT_DEFAULTS as EventConfig,
    sessions: [...EVENT_DEFAULTS.sessions],
    faqs: [...EVENT_DEFAULTS.faqs],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch published event settings
      const { data: settingsRow, error: settingsErr } = await supabase
        .from("event_settings")
        .select("*")
        .eq("published", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (settingsErr) {
        console.error("Error fetching event settings:", settingsErr.message);
        // Use defaults silently — don't expose DB error to UI
        setSettings({
          ...EVENT_DEFAULTS as EventConfig,
          sessions: [...EVENT_DEFAULTS.sessions],
          faqs: [...EVENT_DEFAULTS.faqs],
        });
        setLoading(false);
        return;
      }

      // Fetch sessions — cast to AnyRow[] to avoid never inference
      const { data: rawSessionRows } = await supabase
        .from("event_sessions")
        .select("*")
        .order("display_order", { ascending: true });
      const sessionRows = (rawSessionRows ?? []) as AnyRow[];

      // Fetch FAQs
      const { data: rawFaqRows } = await supabase
        .from("event_faqs")
        .select("*")
        .order("display_order", { ascending: true });
      const faqRows = (rawFaqRows ?? []) as AnyRow[];

      const sessions: EventSession[] = sessionRows.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        description: r.description as string | null,
        startTime: r.start_time as string | null,
        endTime: r.end_time as string | null,
        track: r.track as string | null,
        displayOrder: r.display_order as number,
      }));

      const faqs: FaqEntry[] = faqRows.map((r) => ({
        id: r.id as string,
        question: r.question as string,
        answer: r.answer as string,
        displayOrder: r.display_order as number,
      }));

      if (settingsRow) {
        setSettings(rowToConfig(settingsRow as AnyRow, sessions, faqs));
      } else {
        // No published row — use defaults
        setSettings({
          ...EVENT_DEFAULTS as EventConfig,
          sessions,
          faqs,
        });
      }
    } catch (e) {
      setError("Failed to load event settings. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <EventSettingsContext.Provider value={{ settings, loading, error, refresh }}>
      {children}
    </EventSettingsContext.Provider>
  );
}

export function useEventSettings(): EventSettingsContextValue {
  const ctx = useContext(EventSettingsContext);
  if (!ctx) throw new Error("useEventSettings must be used within EventSettingsProvider");
  return ctx;
}

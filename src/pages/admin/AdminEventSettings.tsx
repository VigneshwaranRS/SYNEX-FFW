import React, { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "../../lib/supabaseAdmin";
import { useAuth } from "../../contexts/AuthContext";
import { eventSettingsSchema } from "../../lib/validation";
import type { EventSettingsFormData } from "../../lib/validation";
import "./AdminDashboard.css";

type SaveStatus =
  | null
  | { type: "saving" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = Record<string, any>;

function toFormData(row: DbRow): Partial<EventSettingsFormData> {
  return {
    event_date: row.event_date ?? "",
    event_start_time: row.event_start_time ?? "",
    event_end_time: row.event_end_time ?? "",
    timezone: row.timezone ?? "Asia/Kolkata",
    venue_name: row.venue_name ?? "",
    venue_address: row.venue_address ?? "",
    venue_map_url: row.venue_map_url ?? "",
    tagline: row.tagline ?? "",
    short_description: row.short_description ?? "",
    registration_open: row.registration_open ?? false,
    registration_deadline: row.registration_deadline ?? "",
    capacity: row.capacity ?? undefined,
    waitlist_enabled: row.waitlist_enabled ?? false,
    eligibility_rules: row.eligibility_rules ?? "",
    internal_student_fee: row.internal_student_fee ?? undefined,
    external_student_fee: row.external_student_fee ?? undefined,
    fee_currency: row.fee_currency ?? "INR",
    payment_enabled: row.payment_enabled ?? false,
    payment_instructions: row.payment_instructions ?? "",
    contact_email: row.contact_email ?? "",
    privacy_notice: row.privacy_notice ?? "",
  };
}

const EMPTY_FORM: Partial<EventSettingsFormData> = {
  event_date: "",
  event_start_time: "",
  event_end_time: "",
  timezone: "Asia/Kolkata",
  venue_name: "",
  venue_address: "",
  venue_map_url: "",
  tagline: "The AI Club's flagship technology event.",
  short_description: "",
  registration_open: false,
  registration_deadline: "",
  capacity: undefined,
  waitlist_enabled: false,
  eligibility_rules: "",
  internal_student_fee: undefined,
  external_student_fee: undefined,
  fee_currency: "INR",
  payment_enabled: false,
  payment_instructions: "",
  contact_email: "",
  privacy_notice: "",
};

export default function AdminEventSettings() {
  const { user } = useAuth();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [form, setForm] = useState<Partial<EventSettingsFormData>>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const [loading, setLoading] = useState(true);
  const [auditLog, setAuditLog] = useState<DbRow[]>([]);
  const [showWarning, setShowWarning] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      // Get the latest settings row (draft or published)
      const { data } = await supabase
        .from("event_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSettingsId(data.id);
        setIsPublished(data.published ?? false);
        setForm(toFormData(data));
      }

      // Fetch audit log
      const { data: audit } = await supabase
        .from("event_settings_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setAuditLog(audit ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value === "" ? undefined : Number(value),
    }));
  }

  function validate(): boolean {
    const result = eventSettingsSchema.safeParse(form);
    if (result.success) {
      setErrors({});
      return true;
    }
    const errs: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string;
      if (!errs[field]) errs[field] = issue.message;
    }
    setErrors(errs);
    return false;
  }

  async function saveToDb(publish: boolean) {
    if (!validate()) return;
    setSaveStatus({ type: "saving" });

    try {
      const payload = {
        ...form,
        // Normalize empty strings to null for DB
        event_date: form.event_date || null,
        event_start_time: form.event_start_time || null,
        event_end_time: form.event_end_time || null,
        venue_name: form.venue_name || null,
        venue_address: form.venue_address || null,
        venue_map_url: form.venue_map_url || null,
        registration_deadline: form.registration_deadline || null,
        eligibility_rules: form.eligibility_rules || null,
        payment_instructions: form.payment_instructions || null,
        contact_email: form.contact_email || null,
        privacy_notice: form.privacy_notice || null,
        published: publish,
        updated_by: user!.id,
        updated_at: new Date().toISOString(),
      };

      let savedId = settingsId;
      if (settingsId) {
        const { error } = await supabase
          .from("event_settings")
          .update(payload)
          .eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("event_settings")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        savedId = data.id;
        setSettingsId(savedId);
      }

      // Write audit entry
      await supabase.from("event_settings_audit").insert({
        actor_id: user!.id,
        actor_email: user!.email ?? null,
        action: publish ? "publish" : "save_draft",
        summary: publish ? "Settings published to public site" : "Settings saved as draft",
      });

      setIsPublished(publish);
      setSaveStatus({
        type: "success",
        message: publish ? "Settings published." : "Draft saved.",
      });
      await fetchSettings();
    } catch (e) {
      setSaveStatus({
        type: "error",
        message: "Save failed. Please try again.",
      });
      console.error(e);
    }
  }

  function handleSaveDraft() {
    saveToDb(false);
  }

  function handlePublish() {
    // Warn if registration_open, fee, or eligibility changed
    const warnings: string[] = [];
    if (form.registration_open !== isPublished) {
      warnings.push("Registration open/closed state will change.");
    }
    if (form.external_student_fee !== undefined) {
      warnings.push("External fee will update.");
    }
    if (form.eligibility_rules) {
      warnings.push("Eligibility wording will update.");
    }

    if (warnings.length > 0) {
      setShowWarning(true);
    } else {
      saveToDb(true);
    }
  }

  function handleConfirmPublish() {
    setShowWarning(false);
    saveToDb(true);
  }

  if (loading) {
    return (
      <div>
        <h2 className="admin-section-title">Event Settings</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 40 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", marginBottom: "var(--sp-6)", flexWrap: "wrap" }}>
        <h2 className="admin-section-title" style={{ marginBottom: 0 }}>Event Settings</h2>
        <span className={`chip ${isPublished ? "chip--open" : "chip--draft"}`}>
          {isPublished ? "Published" : "Draft"}
        </span>
      </div>

      {showWarning && (
        <div className="admin-warning-banner" style={{ marginBottom: "var(--sp-4)" }}>
          <strong>Warning:</strong> Publishing these changes will immediately affect the public website,
          including registration state, fees, and eligibility. Confirm you have verified all details.
          <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-3)" }}>
            <button className="btn btn-danger btn-sm" onClick={handleConfirmPublish}>
              Confirm &amp; publish
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowWarning(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <form
        className="admin-settings-form"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Event settings form"
        noValidate
      >
        {/* Event basics */}
        <div className="admin-settings-group">
          <h3 className="admin-settings-group-title">Event basics</h3>
          <div className="field">
            <label htmlFor="es-tagline">Tagline *</label>
            <input id="es-tagline" name="tagline" type="text" className={`input${errors.tagline ? " error" : ""}`}
              value={form.tagline ?? ""} onChange={handleChange} maxLength={200} />
            {errors.tagline && <span className="field-error">{errors.tagline}</span>}
          </div>
          <div className="field">
            <label htmlFor="es-description">Short description *</label>
            <textarea id="es-description" name="short_description" className={`input${errors.short_description ? " error" : ""}`}
              value={form.short_description ?? ""} onChange={handleChange} rows={4} maxLength={2000} />
            {errors.short_description && <span className="field-error">{errors.short_description}</span>}
          </div>
        </div>

        {/* Date & time */}
        <div className="admin-settings-group">
          <h3 className="admin-settings-group-title">Date &amp; time</h3>
          <div className="admin-settings-row">
            <div className="field">
              <label htmlFor="es-date">Event date</label>
              <input id="es-date" name="event_date" type="date" className={`input${errors.event_date ? " error" : ""}`}
                value={form.event_date ?? ""} onChange={handleChange} />
              {errors.event_date && <span className="field-error">{errors.event_date}</span>}
            </div>
            <div className="field">
              <label htmlFor="es-timezone">Timezone</label>
              <input id="es-timezone" name="timezone" type="text" className="input"
                value={form.timezone ?? "Asia/Kolkata"} onChange={handleChange} />
            </div>
          </div>
          <div className="admin-settings-row">
            <div className="field">
              <label htmlFor="es-start-time">Start time</label>
              <input id="es-start-time" name="event_start_time" type="time" className={`input${errors.event_start_time ? " error" : ""}`}
                value={form.event_start_time ?? ""} onChange={handleChange} />
              {errors.event_start_time && <span className="field-error">{errors.event_start_time}</span>}
            </div>
            <div className="field">
              <label htmlFor="es-end-time">End time</label>
              <input id="es-end-time" name="event_end_time" type="time" className={`input${errors.event_end_time ? " error" : ""}`}
                value={form.event_end_time ?? ""} onChange={handleChange} />
              {errors.event_end_time && <span className="field-error">{errors.event_end_time}</span>}
            </div>
          </div>
        </div>

        {/* Venue */}
        <div className="admin-settings-group">
          <h3 className="admin-settings-group-title">Venue</h3>
          <div className="field">
            <label htmlFor="es-venue-name">Venue name</label>
            <input id="es-venue-name" name="venue_name" type="text" className="input"
              value={form.venue_name ?? ""} onChange={handleChange} maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor="es-venue-address">Full address</label>
            <textarea id="es-venue-address" name="venue_address" className="input"
              value={form.venue_address ?? ""} onChange={handleChange} rows={2} maxLength={500} />
          </div>
          <div className="field">
            <label htmlFor="es-venue-map">Map URL</label>
            <input id="es-venue-map" name="venue_map_url" type="url" className={`input${errors.venue_map_url ? " error" : ""}`}
              value={form.venue_map_url ?? ""} onChange={handleChange} placeholder="https://maps.google.com/…" />
            {errors.venue_map_url && <span className="field-error">{errors.venue_map_url}</span>}
          </div>
        </div>

        {/* Registration */}
        <div className="admin-settings-group">
          <h3 className="admin-settings-group-title">Registration</h3>
          <div className="checkbox-field">
            <input id="es-reg-open" name="registration_open" type="checkbox"
              checked={!!form.registration_open} onChange={handleChange} />
            <label htmlFor="es-reg-open">Registration is currently open</label>
          </div>
          <div className="admin-settings-row">
            <div className="field">
              <label htmlFor="es-reg-deadline">Registration deadline</label>
              <input id="es-reg-deadline" name="registration_deadline" type="date" className="input"
                value={form.registration_deadline ?? ""} onChange={handleChange} />
            </div>
            <div className="field">
              <label htmlFor="es-capacity">Capacity</label>
              <input id="es-capacity" name="capacity" type="number" className="input"
                value={form.capacity ?? ""} onChange={handleNumberChange} min={1} placeholder="Leave blank = unlimited" />
            </div>
          </div>
          <div className="checkbox-field">
            <input id="es-waitlist" name="waitlist_enabled" type="checkbox"
              checked={!!form.waitlist_enabled} onChange={handleChange} />
            <label htmlFor="es-waitlist">Enable waitlist when capacity reached</label>
          </div>
          <div className="field">
            <label htmlFor="es-eligibility">Eligibility rules</label>
            <textarea id="es-eligibility" name="eligibility_rules" className="input"
              value={form.eligibility_rules ?? ""} onChange={handleChange} rows={3} maxLength={1000}
              placeholder="Official organizer-approved wording only. Leave blank until confirmed." />
            <span className="field-hint">Only publish confirmed eligibility wording.</span>
          </div>
        </div>

        {/* Fees */}
        <div className="admin-settings-group">
          <h3 className="admin-settings-group-title">Fees</h3>
          <p className="field-hint" style={{ marginBottom: "var(--sp-3)" }}>
            Leave blank until the organizers officially confirm the fee. Do not guess.
          </p>
          <div className="admin-settings-row">
            <div className="field">
              <label htmlFor="es-internal-fee">Internal student fee</label>
              <input id="es-internal-fee" name="internal_student_fee" type="number" className="input"
                value={form.internal_student_fee ?? ""} onChange={handleNumberChange} min={0} step={1}
                placeholder="e.g. 0 for free" />
            </div>
            <div className="field">
              <label htmlFor="es-external-fee">External student fee</label>
              <input id="es-external-fee" name="external_student_fee" type="number" className="input"
                value={form.external_student_fee ?? ""} onChange={handleNumberChange} min={0} step={1}
                placeholder="Confirmed amount only" />
            </div>
          </div>
          <div className="admin-settings-row">
            <div className="field">
              <label htmlFor="es-currency">Currency</label>
              <input id="es-currency" name="fee_currency" type="text" className="input"
                value={form.fee_currency ?? "INR"} onChange={handleChange} maxLength={3} />
            </div>
          </div>
          <div className="checkbox-field">
            <input id="es-payment-enabled" name="payment_enabled" type="checkbox"
              checked={!!form.payment_enabled} onChange={handleChange} />
            <label htmlFor="es-payment-enabled">Payment collection enabled</label>
          </div>
          {form.payment_enabled && (
            <div className="field">
              <label htmlFor="es-payment-instructions">Payment instructions</label>
              <textarea id="es-payment-instructions" name="payment_instructions" className="input"
                value={form.payment_instructions ?? ""} onChange={handleChange} rows={4} maxLength={2000}
                placeholder="Official instructions only. Do not include UPI PIN, card credentials, or banking passwords." />
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="admin-settings-group">
          <h3 className="admin-settings-group-title">Contact &amp; legal</h3>
          <div className="field">
            <label htmlFor="es-contact-email">Contact email</label>
            <input id="es-contact-email" name="contact_email" type="email" className={`input${errors.contact_email ? " error" : ""}`}
              value={form.contact_email ?? ""} onChange={handleChange} placeholder="Official organizer email" />
            {errors.contact_email && <span className="field-error">{errors.contact_email}</span>}
          </div>
          <div className="field">
            <label htmlFor="es-privacy-notice">Privacy notice</label>
            <textarea id="es-privacy-notice" name="privacy_notice" className="input"
              value={form.privacy_notice ?? ""} onChange={handleChange} rows={5} maxLength={5000}
              placeholder="Organizer-approved privacy notice text. Must be completed before registration opens." />
          </div>
        </div>

        {/* Actions */}
        <div className="admin-form-actions">
          <button id="btn-save-draft" type="button" className="btn btn-secondary"
            onClick={handleSaveDraft} disabled={saveStatus?.type === "saving"}>
            {saveStatus?.type === "saving" ? <><span className="spinner" aria-hidden="true" /> Saving…</> : "Save draft"}
          </button>
          <button id="btn-publish-settings" type="button" className="btn btn-primary"
            onClick={handlePublish} disabled={saveStatus?.type === "saving"}>
            {isPublished ? "Republish" : "Publish to public site"}
          </button>
          {isPublished && (
            <button type="button" className="btn btn-danger btn-sm"
              disabled={saveStatus?.type === "saving"}
              onClick={async () => {
                if (!settingsId) return;
                if (!window.confirm("Unpublish? The public site will fall back to defaults until republished.")) return;
                await supabase.from("event_settings").update({ published: false }).eq("id", settingsId);
                await supabase.from("event_settings_audit").insert({
                  actor_id: user!.id, actor_email: user!.email ?? null,
                  action: "unpublish", summary: "Settings unpublished",
                });
                setIsPublished(false);
                setSaveStatus({ type: "success", message: "Unpublished." });
              }}>
              Unpublish
            </button>
          )}
          {saveStatus && saveStatus.type !== "saving" && (
            <span className={`admin-save-status admin-save-status--${saveStatus.type}`}>
              {saveStatus.message}
            </span>
          )}
        </div>
      </form>

      {/* Audit log */}
      {auditLog.length > 0 && (
        <div style={{ marginTop: "var(--sp-12)" }}>
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--paper)", marginBottom: "var(--sp-4)" }}>
            Change history
          </h3>
          <div className="admin-audit-list">
            {auditLog.map((entry) => (
              <div key={entry.id} className="admin-audit-item">
                <span className="admin-audit-meta">
                  {new Date(entry.created_at).toLocaleString("en-IN")} · {entry.actor_email ?? entry.actor_id} · {entry.action}
                </span>
                <span className="admin-audit-summary">{entry.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

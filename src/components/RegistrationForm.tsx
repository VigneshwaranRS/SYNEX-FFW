import React, { useState, useRef } from "react";
import { useEventSettings } from "../contexts/EventSettingsContext";
import { validateRegistrationForm } from "../lib/validation";
import type { RegistrationFormData } from "../lib/validation";
import { supabase } from "../lib/supabase";
import "./RegistrationForm.css";

type FormState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success"; reference: string; affiliation: string }
  | { phase: "duplicate" }
  | { phase: "closed" }
  | { phase: "capacity_reached" }
  | { phase: "error"; message: string };

const INITIAL_FORM: Partial<RegistrationFormData> & { phone: string; department: string; year_of_study: string } = {
  full_name: "",
  email: "",
  phone: "",
  institution: "",
  affiliation: undefined,
  department: "",
  year_of_study: "",
  consent_given: undefined,
};

export default function RegistrationForm() {
  const { settings } = useEventSettings();
  const [formData, setFormData] = useState({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>({ phase: "idle" });
  const submitRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isSubmitting = state.phase === "submitting";

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Guard against double-submit
    if (submitRef.current) return;

    // Check registration open (server also enforces)
    if (!settings.registrationOpen) {
      setState({ phase: "closed" });
      return;
    }

    // Client-side validation
    const validation = validateRegistrationForm(formData);
    if (!validation.success) {
      setErrors(validation.errors);
      // Focus first error field
      const firstError = Object.keys(validation.errors)[0];
      const el = formRef.current?.elements.namedItem(firstError) as HTMLElement | null;
      el?.focus();
      return;
    }

    submitRef.current = true;
    setState({ phase: "submitting" });

    try {
      const payload = {
        full_name: validation.data.full_name,
        email: validation.data.email,
        phone: validation.data.phone || null,
        institution: validation.data.institution,
        affiliation: validation.data.affiliation,
        department: validation.data.department || null,
        year_of_study: validation.data.year_of_study || null,
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        status: "pending",
      };

      // Call the Edge Function for safe server-side registration
      const { data, error } = await supabase.functions.invoke("register", {
        body: payload,
      });

      if (error) {
        // Parse structured error responses
        const errBody = error.context?.json ?? null;
        const code: string = errBody?.code ?? "";

        if (code === "REGISTRATION_CLOSED") {
          setState({ phase: "closed" });
        } else if (code === "DUPLICATE_REGISTRATION") {
          setState({ phase: "duplicate" });
        } else if (code === "CAPACITY_REACHED") {
          setState({ phase: "capacity_reached" });
        } else {
          const message =
            errBody?.message ??
            "Registration failed. Please try again or contact the organizers.";
          setState({ phase: "error", message });
        }
        return;
      }

      if (data?.reference) {
        setState({
          phase: "success",
          reference: data.reference,
          affiliation: validation.data.affiliation,
        });
        // Clear form
        setFormData({ ...INITIAL_FORM });
        setErrors({});
      } else {
        setState({
          phase: "error",
          message: "Unexpected response from server. Please check your email or contact the organizers.",
        });
      }
    } catch (err) {
      // Network or unexpected error
      setState({
        phase: "error",
        message:
          err instanceof Error && err.message.includes("Failed to fetch")
            ? "Network error. Please check your connection and try again."
            : "An unexpected error occurred. Please try again.",
      });
    } finally {
      submitRef.current = false;
    }
  }

  // ── Success screen ──────────────────────────────────────────────
  if (state.phase === "success") {
    return (
      <section className="section reg-section" id="register" aria-label="Registration confirmation">
        <div className="container">
          <div className="reg-success">
            <div className="reg-success-icon" aria-hidden="true">✓</div>
            <h2 className="reg-success-title">You're registered</h2>
            <p className="reg-success-sub">
              Save this reference number — you'll need it at the event.
            </p>
            <div className="reg-reference-box">
              <span className="label">Reference</span>
              <span className="reg-reference mono" aria-label={`Registration reference: ${state.reference}`}>
                {state.reference}
              </span>
            </div>

            <div className="reg-next-steps">
              <h3 className="reg-next-title">What happens next</h3>
              {state.affiliation === "internal" ? (
                settings.internalStudentFee === 0 || settings.internalStudentFee === null && !settings.paymentEnabled ? (
                  <p>Your registration is received. Bring this reference and your student ID to the event.</p>
                ) : settings.paymentEnabled ? (
                  <p>Payment instructions will be displayed below. Complete payment and note your reference number.</p>
                ) : (
                  <p>Payment details will be announced. Watch for updates from the organizers.</p>
                )
              ) : settings.paymentEnabled && settings.externalStudentFee !== null ? (
                <p>
                  A fee of {settings.feeCurrency} {settings.externalStudentFee} applies.
                  Payment instructions are below.
                </p>
              ) : (
                <p>Payment details will be communicated by the organizers. Retain your reference number.</p>
              )}
              <p className="reg-next-note">
                Confirmation emails are not automatically sent. Please save or print this page.
              </p>
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => setState({ phase: "idle" })}
            >
              Register another participant
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section reg-section" id="register" aria-label="Event registration">
      <div className="container">
        <div className="section-header">
          <span className="label">Register</span>
          <h2 className="section-title">Secure your place</h2>
        </div>

        {/* Registration closed states */}
        {state.phase === "closed" && (
          <div className="alert alert-error reg-state-msg" role="alert">
            Registration is currently closed. Check back for updates.
          </div>
        )}
        {state.phase === "capacity_reached" && (
          <div className="alert alert-warning reg-state-msg" role="alert">
            Registration is full. The organizers may open a waitlist — check back for updates.
          </div>
        )}
        {state.phase === "duplicate" && (
          <div className="alert alert-warning reg-state-msg" role="alert">
            An account with this email address is already registered. If you believe this is an error, contact the organizers.
          </div>
        )}
        {state.phase === "error" && (
          <div className="alert alert-error reg-state-msg" role="alert">
            {state.message}
          </div>
        )}

        {/* Show form only when registration is open */}
        {!settings.registrationOpen ? (
          <div className="reg-closed-box">
            <span className="chip chip--closed">Registration closed</span>
            <p className="reg-closed-text">
              Registration is not currently open. Details will be announced when registration opens.
            </p>
          </div>
        ) : (
          <form
            ref={formRef}
            className="reg-form"
            onSubmit={handleSubmit}
            noValidate
            aria-label="Registration form"
          >
            <div className="reg-form-grid">
              {/* Full name */}
              <div className="field">
                <label htmlFor="reg-full_name">
                  Full name<span className="required-star" aria-hidden="true"> *</span>
                </label>
                <input
                  id="reg-full_name"
                  name="full_name"
                  type="text"
                  className={`input${errors.full_name ? " error" : ""}`}
                  value={formData.full_name ?? ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  autoComplete="name"
                  aria-required="true"
                  aria-describedby={errors.full_name ? "err-full_name" : undefined}
                  aria-invalid={!!errors.full_name}
                  maxLength={100}
                />
                {errors.full_name && (
                  <span id="err-full_name" className="field-error" role="alert">
                    {errors.full_name}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className="field">
                <label htmlFor="reg-email">
                  Email address<span className="required-star" aria-hidden="true"> *</span>
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  className={`input${errors.email ? " error" : ""}`}
                  value={formData.email ?? ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  autoComplete="email"
                  aria-required="true"
                  aria-describedby={errors.email ? "err-email" : undefined}
                  aria-invalid={!!errors.email}
                  maxLength={254}
                />
                {errors.email && (
                  <span id="err-email" className="field-error" role="alert">
                    {errors.email}
                  </span>
                )}
              </div>

              {/* Phone */}
              <div className="field">
                <label htmlFor="reg-phone">
                  Mobile number
                  <span className="field-optional mono"> (optional)</span>
                </label>
                <input
                  id="reg-phone"
                  name="phone"
                  type="tel"
                  className={`input${errors.phone ? " error" : ""}`}
                  value={formData.phone ?? ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  autoComplete="tel"
                  aria-describedby={errors.phone ? "err-phone" : "hint-phone"}
                  aria-invalid={!!errors.phone}
                  maxLength={10}
                  placeholder="10-digit Indian mobile"
                />
                {errors.phone ? (
                  <span id="err-phone" className="field-error" role="alert">
                    {errors.phone}
                  </span>
                ) : (
                  <span id="hint-phone" className="field-hint">
                    10-digit Indian mobile number
                  </span>
                )}
              </div>

              {/* Institution */}
              <div className="field">
                <label htmlFor="reg-institution">
                  College / Institution<span className="required-star" aria-hidden="true"> *</span>
                </label>
                <input
                  id="reg-institution"
                  name="institution"
                  type="text"
                  className={`input${errors.institution ? " error" : ""}`}
                  value={formData.institution ?? ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  autoComplete="organization"
                  aria-required="true"
                  aria-describedby={errors.institution ? "err-institution" : undefined}
                  aria-invalid={!!errors.institution}
                  maxLength={150}
                />
                {errors.institution && (
                  <span id="err-institution" className="field-error" role="alert">
                    {errors.institution}
                  </span>
                )}
              </div>

              {/* Affiliation */}
              <div className="field">
                <label htmlFor="reg-affiliation">
                  Affiliation<span className="required-star" aria-hidden="true"> *</span>
                </label>
                <select
                  id="reg-affiliation"
                  name="affiliation"
                  className={`input${errors.affiliation ? " error" : ""}`}
                  value={formData.affiliation ?? ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  aria-required="true"
                  aria-describedby={
                    errors.affiliation ? "err-affiliation" : "hint-affiliation"
                  }
                  aria-invalid={!!errors.affiliation}
                >
                  <option value="">Select affiliation</option>
                  <option value="internal">SIMATS student (internal)</option>
                  <option value="external">Other college (external)</option>
                </select>
                {errors.affiliation ? (
                  <span id="err-affiliation" className="field-error" role="alert">
                    {errors.affiliation}
                  </span>
                ) : (
                  <span id="hint-affiliation" className="field-hint">
                    Determines registration category. Eligibility verified by organizers.
                  </span>
                )}
              </div>

              {/* Department (optional) */}
              <div className="field">
                <label htmlFor="reg-department">
                  Department
                  <span className="field-optional mono"> (optional)</span>
                </label>
                <input
                  id="reg-department"
                  name="department"
                  type="text"
                  className="input"
                  value={formData.department ?? ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  maxLength={100}
                  placeholder="e.g. Computer Science"
                />
              </div>

              {/* Year (optional) */}
              <div className="field">
                <label htmlFor="reg-year_of_study">
                  Year of study
                  <span className="field-optional mono"> (optional)</span>
                </label>
                <input
                  id="reg-year_of_study"
                  name="year_of_study"
                  type="text"
                  className="input"
                  value={formData.year_of_study ?? ""}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  maxLength={20}
                  placeholder="e.g. 3rd year"
                />
              </div>
            </div>

            {/* Privacy notice */}
            <div className="reg-privacy">
              <div className={`checkbox-field${errors.consent_given ? " error" : ""}`}>
                <input
                  id="reg-consent"
                  name="consent_given"
                  type="checkbox"
                  checked={!!formData.consent_given}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  aria-required="true"
                  aria-describedby={
                    errors.consent_given ? "err-consent" : "hint-consent"
                  }
                  aria-invalid={!!errors.consent_given}
                />
                <label htmlFor="reg-consent">
                  I agree to this registration information being stored and used to
                  organise SYNEX and for event communications.{" "}
                  {settings.privacyNotice ? (
                    <span className="reg-privacy-link">
                      Privacy notice applies.
                    </span>
                  ) : (
                    <span className="reg-privacy-pending">
                      Full privacy notice will be published before the event opens.
                    </span>
                  )}
                  <span className="required-star" aria-hidden="true"> *</span>
                </label>
              </div>
              {errors.consent_given && (
                <span id="err-consent" className="field-error" role="alert">
                  {errors.consent_given}
                </span>
              )}
              <span id="hint-consent" className="sr-only">
                Required to register
              </span>
            </div>

            {/* Submit */}
            <div className="reg-submit-row">
              <button
                id="btn-register-submit"
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={isSubmitting}
                aria-disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Submitting…
                  </>
                ) : (
                  "Submit registration"
                )}
              </button>
              <p className="reg-submit-note mono">
                Double-clicking is safe — duplicate submissions are prevented.
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

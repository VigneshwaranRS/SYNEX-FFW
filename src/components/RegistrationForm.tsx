import React, { useState, useRef, useEffect } from "react";
import { useEventSettings } from "../contexts/EventSettingsContext";
import { supabase } from "../lib/supabase";
import "./RegistrationForm.css";

type FormState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success"; reference: string; affiliation: string }
  | { phase: "duplicate" }
  | { phase: "closed" }
  | { phase: "capacity_reached"; message?: string }
  | { phase: "error"; message: string };

const MAX_TEAM_MEMBERS = 4;
const MIN_TEAM_MEMBERS = 1;
const MAX_INTERNAL_TEAMS = 20;
const MAX_EXTERNAL_TEAMS = 70;

const SIMATS_EMAIL_SUFFIX = ".simats@saveetha.com";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_PDF_TYPES = ["application/pdf"];

interface TeamMember {
  name: string;
  email: string;
  phone: string;
}

interface FormData {
  team_name: string;
  full_name: string; // team lead name
  email: string; // team lead email
  phone: string;
  institution: string;
  affiliation: string;
  department: string;
  year_of_study: string;
  consent_given: boolean;
  team_members: TeamMember[]; // additional members (excluding lead)
  transaction_id: string; // external only
  payment_screenshot: File | null; // external only
  project_pdf: File | null; // internal only
}

const INITIAL_FORM: FormData = {
  team_name: "",
  full_name: "",
  email: "",
  phone: "",
  institution: "",
  affiliation: "",
  department: "",
  year_of_study: "",
  consent_given: false,
  team_members: [],
  transaction_id: "",
  payment_screenshot: null,
  project_pdf: null,
};

function validateEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return "Email is required";
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(trimmed)) return "Please enter a valid email address";
  if (trimmed.length > 254) return "Email address is too long";
  return null;
}

function validateGmail(email: string): string | null {
  const base = validateEmail(email);
  if (base) return base;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.endsWith("@gmail.com")) {
    return "Please enter a valid Gmail address (e.g. name@gmail.com)";
  }
  return null;
}

function validateSimatsEmail(email: string): string | null {
  const base = validateEmail(email);
  if (base) return base;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.endsWith(SIMATS_EMAIL_SUFFIX)) {
    return `SIMATS students must use their college email (e.g. 192521307.simats@saveetha.com)`;
  }
  return null;
}

function validateForm(data: FormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.team_name.trim() || data.team_name.trim().length < 2) {
    errors.team_name = "Team name is required (minimum 2 characters)";
  }
  if (data.team_name.trim().length > 100) {
    errors.team_name = "Team name must be under 100 characters";
  }

  if (!data.full_name.trim() || data.full_name.trim().length < 2) {
    errors.full_name = "Team lead name is required (minimum 2 characters)";
  }
  if (data.full_name.trim().length > 100) {
    errors.full_name = "Name must be under 100 characters";
  }

  if (!data.affiliation) {
    errors.affiliation = "Please select your affiliation";
  }

  // Email validation depends on affiliation
  if (data.affiliation === "internal") {
    const emailErr = validateSimatsEmail(data.email);
    if (emailErr) errors.email = emailErr;
  } else {
    const emailErr = validateGmail(data.email);
    if (emailErr) errors.email = emailErr;
  }

  // Phone is required for the lead
  if (!data.phone.trim()) {
    errors.phone = "Mobile number is required";
  } else if (!/^[6-9]\d{9}$/.test(data.phone.trim())) {
    errors.phone = "Enter a valid 10-digit Indian mobile number";
  }

  if (!data.institution.trim() || data.institution.trim().length < 2) {
    errors.institution = "Institution name is required (minimum 2 characters)";
  }

  if (!data.consent_given) {
    errors.consent_given = "You must agree to the privacy notice to register";
  }

  // Validate team members
  const totalMembers = 1 + data.team_members.length; // lead + others
  if (totalMembers > MAX_TEAM_MEMBERS) {
    errors.team_members = `A team can have at most ${MAX_TEAM_MEMBERS} members (including team lead)`;
  }

  // Each additional member must have name, email, and phone
  data.team_members.forEach((member, idx) => {
    if (!member.name.trim() || member.name.trim().length < 2) {
      errors[`team_member_${idx}_name`] = "Member name is required (minimum 2 characters)";
    }
    // Email validation for team members based on affiliation
    const memberEmailErr = data.affiliation === "internal"
      ? validateSimatsEmail(member.email)
      : validateGmail(member.email);
    if (memberEmailErr) {
      errors[`team_member_${idx}_email`] = memberEmailErr;
    }
    if (!member.phone.trim()) {
      errors[`team_member_${idx}_phone`] = "Mobile number is required";
    } else if (!/^[6-9]\d{9}$/.test(member.phone.trim())) {
      errors[`team_member_${idx}_phone`] = "Enter a valid 10-digit Indian mobile number";
    }
  });

  // External: transaction_id and payment screenshot are required
  if (data.affiliation === "external") {
    if (!data.transaction_id.trim()) {
      errors.transaction_id = "Transaction ID is required for external participants";
    }
    if (!data.payment_screenshot) {
      errors.payment_screenshot = "Payment screenshot is required for external participants";
    } else {
      if (!ALLOWED_IMAGE_TYPES.includes(data.payment_screenshot.type)) {
        errors.payment_screenshot = "Please upload a JPG, PNG, or WebP image";
      }
      if (data.payment_screenshot.size > MAX_FILE_SIZE_BYTES) {
        errors.payment_screenshot = `File size must be under ${MAX_FILE_SIZE_MB}MB`;
      }
    }
  }

  // Internal: project PDF is required
  if (data.affiliation === "internal") {
    if (!data.project_pdf) {
      errors.project_pdf = "Project PPT (PDF format) is required for internal participants";
    } else {
      if (!ALLOWED_PDF_TYPES.includes(data.project_pdf.type)) {
        errors.project_pdf = "Please upload a PDF file";
      }
      if (data.project_pdf.size > MAX_FILE_SIZE_BYTES) {
        errors.project_pdf = `File size must be under ${MAX_FILE_SIZE_MB}MB`;
      }
    }
  }

  return errors;
}

export default function RegistrationForm() {
  const { settings } = useEventSettings();
  const [formData, setFormData] = useState<FormData>({ ...INITIAL_FORM, team_members: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>({ phase: "idle" });
  const [teamCounts, setTeamCounts] = useState<{ internal: number; external: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const submitRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const isSubmitting = state.phase === "submitting";

  // Fetch current team counts to show remaining slots
  useEffect(() => {
    async function fetchCounts() {
      try {
        const { count: internalCount } = await supabase
          .from("registrations")
          .select("*", { count: "exact", head: true })
          .eq("affiliation", "internal")
          .neq("status", "cancelled");

        const { count: externalCount } = await supabase
          .from("registrations")
          .select("*", { count: "exact", head: true })
          .eq("affiliation", "external")
          .neq("status", "cancelled");

        setTeamCounts({
          internal: internalCount ?? 0,
          external: externalCount ?? 0,
        });
      } catch {
        // silently fail — counts are informational
      }
    }
    if (settings.registrationOpen) {
      fetchCounts();
    }
  }, [settings.registrationOpen]);

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

  function handleMemberChange(idx: number, field: keyof TeamMember, value: string) {
    setFormData((prev) => {
      const members = [...prev.team_members];
      members[idx] = { ...members[idx], [field]: value };
      return { ...prev, team_members: members };
    });
    // Clear member error
    const errKey = `team_member_${idx}_${field}`;
    if (errors[errKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
  }

  function addMember() {
    const totalMembers = 1 + formData.team_members.length;
    if (totalMembers >= MAX_TEAM_MEMBERS) return;
    setFormData((prev) => ({
      ...prev,
      team_members: [...prev.team_members, { name: "", email: "", phone: "" }],
    }));
  }

  function removeMember(idx: number) {
    setFormData((prev) => ({
      ...prev,
      team_members: prev.team_members.filter((_, i) => i !== idx),
    }));
    // Clear errors for removed member
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`team_member_${idx}_name`];
      delete next[`team_member_${idx}_email`];
      delete next[`team_member_${idx}_phone`];
      delete next.team_members;
      return next;
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, field: "payment_screenshot" | "project_pdf") {
    const file = e.target.files?.[0] ?? null;
    setFormData((prev) => ({ ...prev, [field]: file }));
    // Clear error
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
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
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Focus first error field
      const firstError = Object.keys(validationErrors)[0];
      const el = formRef.current?.querySelector(`[name="${firstError}"], #reg-${firstError}`) as HTMLElement | null;
      el?.focus();
      return;
    }

    // Client-side capacity check for team limits
    if (teamCounts) {
      if (formData.affiliation === "internal" && teamCounts.internal >= MAX_INTERNAL_TEAMS) {
        setState({
          phase: "capacity_reached",
          message: `Internal team slots are full (${MAX_INTERNAL_TEAMS}/${MAX_INTERNAL_TEAMS} teams registered). Contact the organizers for waitlist options.`,
        });
        return;
      }
      if (formData.affiliation === "external" && teamCounts.external >= MAX_EXTERNAL_TEAMS) {
        setState({
          phase: "capacity_reached",
          message: `External team slots are full (${MAX_EXTERNAL_TEAMS}/${MAX_EXTERNAL_TEAMS} teams registered). Contact the organizers for waitlist options.`,
        });
        return;
      }
    }

    submitRef.current = true;
    setState({ phase: "submitting" });

    try {
      // Prepare team members as structured objects
      const memberObjects = formData.team_members
        .filter((m) => m.name.trim())
        .map((m) => ({
          name: m.name.trim(),
          email: m.email.trim().toLowerCase(),
          phone: m.phone.trim(),
        }));

      // First, upload files if needed
      let paymentScreenshotUrl: string | null = null;
      let projectPdfUrl: string | null = null;

      const timestamp = Date.now();
      const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 40);

      if (formData.affiliation === "external" && formData.payment_screenshot) {
        setUploadProgress("Uploading payment screenshot…");
        const ext = formData.payment_screenshot.name.split(".").pop() || "jpg";
        const path = `payment-screenshots/${sanitize(formData.team_name.trim())}_${timestamp}.${ext}`;
        
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("registration-uploads")
          .upload(path, formData.payment_screenshot, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadErr) {
          setState({ phase: "error", message: "Failed to upload payment screenshot. Please try again." });
          return;
        }
        const { data: urlData } = supabase.storage
          .from("registration-uploads")
          .getPublicUrl(uploadData.path);
        paymentScreenshotUrl = urlData.publicUrl;
      }

      if (formData.affiliation === "internal" && formData.project_pdf) {
        setUploadProgress("Uploading project PDF…");
        const path = `project-pdfs/${sanitize(formData.team_name.trim())}_${timestamp}.pdf`;
        
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("registration-uploads")
          .upload(path, formData.project_pdf, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadErr) {
          setState({ phase: "error", message: "Failed to upload project PDF. Please try again." });
          return;
        }
        const { data: urlData } = supabase.storage
          .from("registration-uploads")
          .getPublicUrl(uploadData.path);
        projectPdfUrl = urlData.publicUrl;
      }

      setUploadProgress("Registering team…");

      const payload = {
        team_name: formData.team_name.trim(),
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || null,
        institution: formData.institution.trim(),
        affiliation: formData.affiliation,
        department: formData.department.trim() || null,
        year_of_study: formData.year_of_study.trim() || null,
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        status: "pending",
        team_members: memberObjects,
        transaction_id: formData.affiliation === "external" ? formData.transaction_id.trim() : null,
        payment_screenshot_url: paymentScreenshotUrl,
        project_pdf_url: projectPdfUrl,
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
          setState({ phase: "capacity_reached", message: errBody?.message });
        } else if (code === "INTERNAL_LIMIT_REACHED") {
          setState({
            phase: "capacity_reached",
            message: `Internal team slots are full (${MAX_INTERNAL_TEAMS} teams). Contact the organizers.`,
          });
        } else if (code === "EXTERNAL_LIMIT_REACHED") {
          setState({
            phase: "capacity_reached",
            message: `External team slots are full (${MAX_EXTERNAL_TEAMS} teams). Contact the organizers.`,
          });
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
          affiliation: formData.affiliation,
        });
        // Clear form
        setFormData({ ...INITIAL_FORM, team_members: [] });
        setErrors({});
        setUploadProgress(null);
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
      setUploadProgress(null);
    }
  }

  const totalMemberCount = 1 + formData.team_members.length;
  const canAddMore = totalMemberCount < MAX_TEAM_MEMBERS;

  // ── Success screen ──────────────────────────────────────────────
  if (state.phase === "success") {
    return (
      <section className="section reg-section" id="register" aria-label="Registration confirmation">
        <div className="container">
          <div className="reg-success">
            <div className="reg-success-icon" aria-hidden="true">✓</div>
            <h2 className="reg-success-title">Your team is registered!</h2>
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
                <p>
                  Your team registration and project PDF have been submitted. Our team will review your submission
                  and shortlist teams. Keep your reference number safe.
                </p>
              ) : (
                <p>
                  Your team registration and payment details have been submitted. Our team will verify your
                  payment and confirm your registration. Keep your reference number safe.
                </p>
              )}
              <p className="reg-next-note">
                Confirmation emails are not automatically sent. Please save or print this page.
              </p>
              <p className="reg-info-note">
                Only the team lead needs to register — all team members are recorded under this reference.
              </p>
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => setState({ phase: "idle" })}
            >
              Register another team
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
          <h2 className="section-title">Register your team</h2>
          <p className="section-subtitle">
            Only the <strong>team lead</strong> needs to register. You can add up to {MAX_TEAM_MEMBERS} members per team (including yourself).
          </p>
        </div>



        {/* Registration closed states */}
        {state.phase === "closed" && (
          <div className="alert alert-error reg-state-msg" role="alert">
            Registration is currently closed. Check back for updates.
          </div>
        )}
        {state.phase === "capacity_reached" && (
          <div className="alert alert-warning reg-state-msg" role="alert">
            {state.message || "Registration is full. The organizers may open a waitlist — check back for updates."}
          </div>
        )}
        {state.phase === "duplicate" && (
          <div className="alert alert-warning reg-state-msg" role="alert">
            A team with this email address is already registered. If you believe this is an error, contact the organizers.
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
            aria-label="Team registration form"
          >
            {/* Team info section */}
            <div className="reg-form-section">
              <h3 className="reg-form-section-title">Team details</h3>
              <div className="reg-form-grid">
                {/* Team name */}
                <div className="field field--full">
                  <label htmlFor="reg-team_name">
                    Team name<span className="required-star" aria-hidden="true"> *</span>
                  </label>
                  <input
                    id="reg-team_name"
                    name="team_name"
                    type="text"
                    className={`input${errors.team_name ? " error" : ""}`}
                    value={formData.team_name}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    aria-required="true"
                    aria-describedby={errors.team_name ? "err-team_name" : undefined}
                    aria-invalid={!!errors.team_name}
                    maxLength={100}
                    placeholder="e.g. Code Breakers"
                  />
                  {errors.team_name && (
                    <span id="err-team_name" className="field-error" role="alert">
                      {errors.team_name}
                    </span>
                  )}
                </div>

                {/* Affiliation */}
                <div className="field field--full">
                  <label htmlFor="reg-affiliation">
                    Affiliation<span className="required-star" aria-hidden="true"> *</span>
                  </label>
                  <select
                    id="reg-affiliation"
                    name="affiliation"
                    className={`input${errors.affiliation ? " error" : ""}`}
                    value={formData.affiliation}
                    onChange={(e) => {
                      handleChange(e);
                      // Reset file fields when switching affiliation
                      setFormData((prev) => ({
                        ...prev,
                        affiliation: e.target.value,
                        transaction_id: "",
                        payment_screenshot: null,
                        project_pdf: null,
                      }));
                      // Clear file-related errors
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.transaction_id;
                        delete next.payment_screenshot;
                        delete next.project_pdf;
                        return next;
                      });
                    }}
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
                      Internal: max {MAX_INTERNAL_TEAMS} teams · External: max {MAX_EXTERNAL_TEAMS} teams
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Team lead section */}
            <div className="reg-form-section">
              <h3 className="reg-form-section-title">Team lead (your details)</h3>
              <p className="reg-form-section-hint">
                Only the team lead needs to fill this form. Other members don't need to register separately.
              </p>
              <div className="reg-form-grid">
                {/* Full name */}
                <div className="field field--full">
                  <label htmlFor="reg-full_name">
                    Full name<span className="required-star" aria-hidden="true"> *</span>
                  </label>
                  <input
                    id="reg-full_name"
                    name="full_name"
                    type="text"
                    className={`input${errors.full_name ? " error" : ""}`}
                    value={formData.full_name}
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
                <div className="field field--full">
                  <label htmlFor="reg-email">
                    {formData.affiliation === "internal" ? "College email" : "Gmail address"}<span className="required-star" aria-hidden="true"> *</span>
                  </label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    className={`input${errors.email ? " error" : ""}`}
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    autoComplete="email"
                    aria-required="true"
                    aria-describedby={errors.email ? "err-email" : "hint-email"}
                    aria-invalid={!!errors.email}
                    maxLength={254}
                    placeholder={formData.affiliation === "internal" ? "192521307.simats@saveetha.com" : "you@gmail.com"}
                  />
                  {errors.email ? (
                    <span id="err-email" className="field-error" role="alert">
                      {errors.email}
                    </span>
                  ) : formData.affiliation === "internal" ? (
                    <span id="hint-email" className="field-hint">
                      Must be your SIMATS college email ending with <strong>.simats@saveetha.com</strong>
                    </span>
                  ) : (
                    <span id="hint-email" className="field-hint">
                      Team lead's Gmail address
                    </span>
                  )}
                </div>

                {/* Phone */}
                <div className="field">
                  <label htmlFor="reg-phone">
                    Mobile number<span className="required-star" aria-hidden="true"> *</span>
                  </label>
                  <input
                    id="reg-phone"
                    name="phone"
                    type="tel"
                    className={`input${errors.phone ? " error" : ""}`}
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    autoComplete="tel"
                    aria-required="true"
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
                    value={formData.institution}
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
                    value={formData.department}
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
                    value={formData.year_of_study}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    maxLength={20}
                    placeholder="e.g. 3rd year"
                  />
                </div>
              </div>
            </div>

            {/* Team members section */}
            <div className="reg-form-section">
              <h3 className="reg-form-section-title">
                Team members
                <span className="reg-member-count mono">
                  {totalMemberCount}/{MAX_TEAM_MEMBERS}
                </span>
              </h3>
              <p className="reg-form-section-hint">
                You (team lead) are already counted. Add up to {MAX_TEAM_MEMBERS - 1} additional members.
                Teams can have {MIN_TEAM_MEMBERS}–{MAX_TEAM_MEMBERS} members total.
              </p>

              {errors.team_members && (
                <div className="field-error" role="alert" style={{ marginBottom: "var(--sp-3)" }}>
                  {errors.team_members}
                </div>
              )}

              <div className="reg-members-list">
                {/* Team lead (read-only display) */}
                <div className="reg-member-row reg-member-lead">
                  <span className="reg-member-badge">Lead</span>
                  <span className="reg-member-name">{formData.full_name || "—"}</span>
                  {formData.email && (
                    <span className="reg-member-detail">{formData.email}</span>
                  )}
                  {formData.phone && (
                    <span className="reg-member-detail">{formData.phone}</span>
                  )}
                </div>

                {/* Additional members */}
                {formData.team_members.map((member, idx) => (
                  <div key={idx} className="reg-member-card">
                    <div className="reg-member-card-header">
                      <span className="reg-member-badge">#{idx + 2}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm reg-member-remove"
                        onClick={() => removeMember(idx)}
                        disabled={isSubmitting}
                        aria-label={`Remove member ${idx + 2}`}
                      >
                        ×
                      </button>
                    </div>
                    <div className="reg-member-fields">
                      <div className="field">
                        <label htmlFor={`reg-member-${idx}-name`}>
                          Full name<span className="required-star" aria-hidden="true"> *</span>
                        </label>
                        <input
                          id={`reg-member-${idx}-name`}
                          type="text"
                          className={`input${errors[`team_member_${idx}_name`] ? " error" : ""}`}
                          value={member.name}
                          onChange={(e) => handleMemberChange(idx, "name", e.target.value)}
                          disabled={isSubmitting}
                          placeholder={`Member ${idx + 2} full name`}
                          maxLength={100}
                          aria-label={`Team member ${idx + 2} name`}
                        />
                        {errors[`team_member_${idx}_name`] && (
                          <span className="field-error" role="alert">
                            {errors[`team_member_${idx}_name`]}
                          </span>
                        )}
                      </div>
                      <div className="field">
                        <label htmlFor={`reg-member-${idx}-email`}>
                          {formData.affiliation === "internal" ? "College email" : "Gmail"}<span className="required-star" aria-hidden="true"> *</span>
                        </label>
                        <input
                          id={`reg-member-${idx}-email`}
                          type="email"
                          className={`input${errors[`team_member_${idx}_email`] ? " error" : ""}`}
                          value={member.email}
                          onChange={(e) => handleMemberChange(idx, "email", e.target.value)}
                          disabled={isSubmitting}
                          placeholder={formData.affiliation === "internal" ? "192521307.simats@saveetha.com" : "member@gmail.com"}
                          maxLength={254}
                          aria-label={`Team member ${idx + 2} email`}
                        />
                        {errors[`team_member_${idx}_email`] && (
                          <span className="field-error" role="alert">
                            {errors[`team_member_${idx}_email`]}
                          </span>
                        )}
                      </div>
                      <div className="field">
                        <label htmlFor={`reg-member-${idx}-phone`}>
                          Mobile<span className="required-star" aria-hidden="true"> *</span>
                        </label>
                        <input
                          id={`reg-member-${idx}-phone`}
                          type="tel"
                          className={`input${errors[`team_member_${idx}_phone`] ? " error" : ""}`}
                          value={member.phone}
                          onChange={(e) => handleMemberChange(idx, "phone", e.target.value)}
                          disabled={isSubmitting}
                          placeholder="10-digit mobile"
                          maxLength={10}
                          aria-label={`Team member ${idx + 2} phone`}
                        />
                        {errors[`team_member_${idx}_phone`] && (
                          <span className="field-error" role="alert">
                            {errors[`team_member_${idx}_phone`]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {canAddMore && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm reg-add-member"
                    onClick={addMember}
                    disabled={isSubmitting}
                  >
                    + Add member
                  </button>
                )}
              </div>
            </div>

            {/* Payment / Upload section — conditional on affiliation */}
            {formData.affiliation === "external" && (
              <div className="reg-form-section">
                <h3 className="reg-form-section-title">
                  💳 Payment details
                </h3>
                <p className="reg-form-section-hint">
                  Scan the QR code below to make the payment, then provide your transaction details.
                  Your registration will be confirmed after payment verification.
                </p>

                {/* Payment QR Code */}
                <div className="reg-qr-display">
                  <div className="reg-qr-card">
                    <img
                      src="/payment-qr.jpg"
                      alt="Payment QR code — Saveetha School of Engineering, UPI ID: 9894970549@indianbk"
                      className="reg-qr-image"
                    />
                    <div className="reg-qr-info">
                      <span className="reg-qr-upi-label">UPI ID</span>
                      <span className="reg-qr-upi-id mono">9894970549@indianbk</span>
                    </div>
                    <p className="reg-qr-hint">
                      Scan with any UPI app (Google Pay, PhonePe, Paytm, etc.)
                    </p>
                  </div>
                </div>

                <div className="reg-form-grid">
                  {/* Transaction ID */}
                  <div className="field field--full">
                    <label htmlFor="reg-transaction_id">
                      Transaction ID<span className="required-star" aria-hidden="true"> *</span>
                    </label>
                    <input
                      id="reg-transaction_id"
                      name="transaction_id"
                      type="text"
                      className={`input${errors.transaction_id ? " error" : ""}`}
                      value={formData.transaction_id}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      aria-required="true"
                      aria-describedby={errors.transaction_id ? "err-transaction_id" : "hint-transaction_id"}
                      aria-invalid={!!errors.transaction_id}
                      maxLength={100}
                      placeholder="e.g. UPI transaction ID or bank reference"
                    />
                    {errors.transaction_id ? (
                      <span id="err-transaction_id" className="field-error" role="alert">
                        {errors.transaction_id}
                      </span>
                    ) : (
                      <span id="hint-transaction_id" className="field-hint">
                        Enter the transaction ID from your payment confirmation
                      </span>
                    )}
                  </div>

                  {/* Payment screenshot */}
                  <div className="field field--full">
                    <label htmlFor="reg-payment_screenshot">
                      Payment screenshot<span className="required-star" aria-hidden="true"> *</span>
                    </label>
                    <div
                      className={`reg-upload-area${errors.payment_screenshot ? " reg-upload-area--error" : ""}${formData.payment_screenshot ? " reg-upload-area--has-file" : ""}`}
                      onClick={() => screenshotInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") screenshotInputRef.current?.click(); }}
                    >
                      <input
                        ref={screenshotInputRef}
                        id="reg-payment_screenshot"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={(e) => handleFileChange(e, "payment_screenshot")}
                        disabled={isSubmitting}
                        style={{ display: "none" }}
                      />
                      {formData.payment_screenshot ? (
                        <div className="reg-upload-file-info">
                          <span className="reg-upload-file-icon">📎</span>
                          <span className="reg-upload-file-name">{formData.payment_screenshot.name}</span>
                          <span className="reg-upload-file-size">
                            ({(formData.payment_screenshot.size / 1024).toFixed(0)} KB)
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData((prev) => ({ ...prev, payment_screenshot: null }));
                              if (screenshotInputRef.current) screenshotInputRef.current.value = "";
                            }}
                            aria-label="Remove file"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="reg-upload-placeholder">
                          <span className="reg-upload-icon">📸</span>
                          <span className="reg-upload-text">Click to upload payment screenshot</span>
                          <span className="reg-upload-hint">JPG, PNG, or WebP · Max {MAX_FILE_SIZE_MB}MB</span>
                        </div>
                      )}
                    </div>
                    {errors.payment_screenshot && (
                      <span className="field-error" role="alert">
                        {errors.payment_screenshot}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {formData.affiliation === "internal" && (
              <div className="reg-form-section">
                <h3 className="reg-form-section-title">
                  📄 Project submission
                </h3>
                <p className="reg-form-section-hint">
                  Upload a PDF of the PPT for a project your team has already completed.
                  This is used to shortlist internal teams — no payment is required.
                </p>
                <div className="reg-form-grid">
                  {/* Project PDF */}
                  <div className="field field--full">
                    <label htmlFor="reg-project_pdf">
                      Project PPT (PDF)<span className="required-star" aria-hidden="true"> *</span>
                    </label>
                    <div
                      className={`reg-upload-area${errors.project_pdf ? " reg-upload-area--error" : ""}${formData.project_pdf ? " reg-upload-area--has-file" : ""}`}
                      onClick={() => pdfInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") pdfInputRef.current?.click(); }}
                    >
                      <input
                        ref={pdfInputRef}
                        id="reg-project_pdf"
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileChange(e, "project_pdf")}
                        disabled={isSubmitting}
                        style={{ display: "none" }}
                      />
                      {formData.project_pdf ? (
                        <div className="reg-upload-file-info">
                          <span className="reg-upload-file-icon">📎</span>
                          <span className="reg-upload-file-name">{formData.project_pdf.name}</span>
                          <span className="reg-upload-file-size">
                            ({(formData.project_pdf.size / 1024).toFixed(0)} KB)
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData((prev) => ({ ...prev, project_pdf: null }));
                              if (pdfInputRef.current) pdfInputRef.current.value = "";
                            }}
                            aria-label="Remove file"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="reg-upload-placeholder">
                          <span className="reg-upload-icon">📄</span>
                          <span className="reg-upload-text">Click to upload your project PPT (PDF)</span>
                          <span className="reg-upload-hint">PDF format only · Max {MAX_FILE_SIZE_MB}MB</span>
                        </div>
                      )}
                    </div>
                    {errors.project_pdf && (
                      <span className="field-error" role="alert">
                        {errors.project_pdf}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

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
                    {uploadProgress || "Submitting…"}
                  </>
                ) : (
                  "Register team"
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

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabaseAdmin as supabase } from "../../lib/supabaseAdmin";
import { useAuth } from "../../contexts/AuthContext";
import "./AdminDashboard.css";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const QR_BUCKET = "payment-qr";

export default function AdminPaymentSettings() {
  const { user } = useAuth();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    null | { type: "success" | "error"; message: string }
  >(null);

  const [payeeLabel, setPayeeLabel] = useState("");
  const [instructions, setInstructions] = useState("");
  const [refFormat, setRefFormat] = useState("");
  const [amountRules, setAmountRules] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [qrEnabled, setQrEnabled] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const [qrPath, setQrPath] = useState<string | null>(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("payment_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (data) {
        setSettingsId(data.id);
        setPayeeLabel(data.payee_label ?? "");
        setInstructions(data.payment_instructions ?? "");
        setRefFormat(data.payment_reference_format ?? "");
        setAmountRules(data.amount_rules ?? "");
        setEnabled(data.enabled ?? false);
        setQrEnabled(data.qr_enabled ?? false);
        setCategories(data.applicable_categories ?? []);
        setQrPath(data.qr_image_path ?? null);

        if (data.qr_image_path) {
          const { data: signedData } = await supabase.storage
            .from(QR_BUCKET)
            .createSignedUrl(data.qr_image_path, 300);
          setQrPreviewUrl(signedData?.signedUrl ?? null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Only PNG, JPEG, GIF, or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError("File must be under 2 MB.");
      return;
    }

    setUploadProgress("Uploading…");
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `qr-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(QR_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadErr) {
        setUploadError("Upload failed: " + uploadErr.message);
        return;
      }

      setQrPath(path);

      // Generate preview URL
      const { data: signedData } = await supabase.storage
        .from(QR_BUCKET)
        .createSignedUrl(path, 300);
      setQrPreviewUrl(signedData?.signedUrl ?? null);
      setUploadProgress("Upload complete. Save settings to publish.");
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveQr() {
    if (!qrPath) return;
    if (!window.confirm("Remove the current QR image? This will disable QR display immediately on save.")) return;
    setQrPath(null);
    setQrPreviewUrl(null);
    setQrEnabled(false);
  }

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus(null);
    try {
      const payload = {
        payee_label: payeeLabel || null,
        payment_instructions: instructions || null,
        payment_reference_format: refFormat || null,
        amount_rules: amountRules || null,
        enabled,
        qr_enabled: qrEnabled && !!qrPath,
        qr_image_path: qrPath,
        applicable_categories: categories,
        updated_by: user!.id,
        updated_at: new Date().toISOString(),
      };

      if (settingsId) {
        const { error } = await supabase
          .from("payment_settings")
          .update(payload)
          .eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("payment_settings")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setSettingsId(data.id);
      }

      await supabase.from("event_settings_audit").insert({
        actor_id: user!.id,
        actor_email: user!.email ?? null,
        action: "update_payment_settings",
        summary: `Payment settings updated. QR enabled: ${qrEnabled && !!qrPath}. Enabled: ${enabled}.`,
      });

      setSaveStatus({ type: "success", message: "Payment settings saved." });
    } catch (e) {
      setSaveStatus({ type: "error", message: "Save failed. Please try again." });
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h2 className="admin-section-title">Payment Settings</h2>
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="admin-section-title">Payment Settings</h2>

      <div className="alert alert-warning" style={{ marginBottom: "var(--sp-6)", maxWidth: "42rem" }} role="note">
        <strong>Important:</strong> Only configure payment settings after the organizers have officially
        confirmed the payment method, payee, and fees. Do not guess or invent payment details.
        Never collect UPI PINs, card PINs, or banking passwords.
      </div>

      <div className="admin-settings-form">
        {/* General */}
        <div className="admin-settings-group">
          <h3 className="admin-settings-group-title">General</h3>
          <div className="checkbox-field">
            <input id="ps-enabled" type="checkbox" checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)} />
            <label htmlFor="ps-enabled">Payment collection enabled</label>
          </div>
          <div className="field">
            <label htmlFor="ps-payee">Payee / beneficiary name</label>
            <input id="ps-payee" type="text" className="input" value={payeeLabel}
              onChange={(e) => setPayeeLabel(e.target.value)} maxLength={200}
              placeholder="Exact name as shown in payment — confirmed by organizers only" />
          </div>
          <div className="field">
            <label htmlFor="ps-amount-rules">Fee / amount rules</label>
            <input id="ps-amount-rules" type="text" className="input" value={amountRules}
              onChange={(e) => setAmountRules(e.target.value)} maxLength={500}
              placeholder="e.g. 'Internal: Free, External: ₹XXX'" />
          </div>
          <div className="field">
            <label htmlFor="ps-instructions">Payment instructions</label>
            <textarea id="ps-instructions" className="input" value={instructions}
              onChange={(e) => setInstructions(e.target.value)} rows={5} maxLength={2000}
              placeholder="Official step-by-step instructions. Do not include secrets or credentials." />
          </div>
          <div className="field">
            <label htmlFor="ps-ref-format">Payment reference format</label>
            <input id="ps-ref-format" type="text" className="input" value={refFormat}
              onChange={(e) => setRefFormat(e.target.value)} maxLength={200}
              placeholder="e.g. 'SYNEX-<your-reference>'" />
          </div>
          <div>
            <p style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--paper)", marginBottom: "var(--sp-2)" }}>
              Applicable to
            </p>
            <div style={{ display: "flex", gap: "var(--sp-4)" }}>
              {["internal", "external"].map((cat) => (
                <div key={cat} className="checkbox-field">
                  <input id={`ps-cat-${cat}`} type="checkbox" checked={categories.includes(cat)}
                    onChange={() => toggleCategory(cat)} />
                  <label htmlFor={`ps-cat-${cat}`} style={{ textTransform: "capitalize" }}>{cat} students</label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QR code */}
        <div className="admin-settings-group">
          <h3 className="admin-settings-group-title">Payment QR image</h3>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--paper-dim)", lineHeight: 1.6 }}>
            Upload the official payment QR image supplied by the organizers.
            Do not generate or fabricate a QR code. Max 2 MB, PNG/JPEG/GIF/WebP.
            The QR image does not contain secrets — it is a public payment display image only.
          </p>

          {/* Always show the static QR image */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", alignItems: "flex-start" }}>
            <p className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--accent)" }}>
              Current payment QR (static asset):
            </p>
            <img
              src="/payment-qr.jpg"
              alt="Current payment QR code"
              className="admin-qr-preview"
              style={{ maxWidth: "280px", maxHeight: "280px" }}
            />
            <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--paper-dim)" }}>
              File: /public/payment-qr.jpg · To replace, update this file and redeploy.
            </span>
          </div>

          {qrPreviewUrl && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", alignItems: "flex-start", marginTop: "var(--sp-4)" }}>
              <p className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--paper-dim)" }}>
                Uploaded QR (Supabase Storage):
              </p>
              <img
                src={qrPreviewUrl}
                alt="Uploaded payment QR code preview"
                className="admin-qr-preview"
              />
              <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--paper-dim)" }}>
                Path: {qrPath}
              </span>
              <button className="btn btn-danger btn-sm" onClick={handleRemoveQr}>
                Remove uploaded QR
              </button>
            </div>
          )}

          <div className="admin-qr-upload-area">
            <label htmlFor="qr-file-input" style={{ cursor: "pointer", textAlign: "center" }}>
              <p className="admin-qr-upload-label">
                {qrPreviewUrl ? "Replace QR image" : "Upload QR image"}
              </p>
              <p className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--paper-dim)" }}>
                Click to browse · PNG, JPEG, GIF, WebP · max 2 MB
              </p>
            </label>
            <input
              id="qr-file-input"
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            {uploadProgress && (
              <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--accent)" }}>
                {uploadProgress}
              </span>
            )}
            {uploadError && (
              <span className="field-error">{uploadError}</span>
            )}
          </div>

          <div className="checkbox-field">
            <input id="ps-qr-enabled" type="checkbox"
              checked={qrEnabled && !!qrPath}
              disabled={!qrPath}
              onChange={(e) => setQrEnabled(e.target.checked)} />
            <label htmlFor="ps-qr-enabled">
              Show QR code to participants
              {!qrPath && <span className="mono" style={{ color: "var(--paper-dim)" }}> (upload a QR image first)</span>}
            </label>
          </div>
        </div>

        <div className="admin-form-actions">
          <button id="btn-save-payment" className="btn btn-primary"
            onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" aria-hidden="true" /> Saving…</> : "Save payment settings"}
          </button>
          {saveStatus && (
            <span className={`admin-save-status admin-save-status--${saveStatus.type}`}>
              {saveStatus.message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

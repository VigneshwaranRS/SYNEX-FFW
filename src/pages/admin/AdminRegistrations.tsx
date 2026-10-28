import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "../../lib/supabaseAdmin";
import type { PaymentStatus, RegistrationStatus, TeamMemberRecord } from "../../lib/database.types";
import { useAuth } from "../../contexts/AuthContext";
import "./AdminDashboard.css";

interface RegistrationRow {
  id: string;
  reference: string;
  team_name: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  institution: string;
  affiliation: string;
  department: string | null;
  year_of_study: string | null;
  team_members: TeamMemberRecord[] | string[];
  transaction_id: string | null;
  payment_screenshot_url: string | null;
  project_pdf_url: string | null;
  status: RegistrationStatus;
  created_at: string;
  payments?: { status: PaymentStatus; amount: number | null }[];
  attendance?: { checked_in_at: string; checked_in_by: string }[];
}

interface Totals {
  total: number;
  internalTeams: number;
  externalTeams: number;
  pendingPayment: number;
  verifiedPayment: number;
  checkedIn: number;
}

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  not_required: "Not required",
  pending: "Pending",
  submitted_for_review: "Under review",
  verified: "Verified",
  failed: "Failed",
  rejected: "Rejected",
};

const PAYMENT_CHIP: Record<PaymentStatus, string> = {
  not_required: "chip--draft",
  pending: "chip--pending",
  submitted_for_review: "chip--pending",
  verified: "chip--verified",
  failed: "chip--closed",
  rejected: "chip--closed",
};

export default function AdminRegistrations() {
  const { user, isAdmin } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [totals, setTotals] = useState<Totals>({
    total: 0, internalTeams: 0, externalTeams: 0,
    pendingPayment: 0, verifiedPayment: 0, checkedIn: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterAffiliation, setFilterAffiliation] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterCheckin, setFilterCheckin] = useState<string>("all");
  const [selected, setSelected] = useState<RegistrationRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = supabase
        .from("registrations")
        .select(`
          id, reference, team_name, full_name, email, phone, institution, affiliation,
          department, year_of_study, team_members, transaction_id, payment_screenshot_url,
          project_pdf_url, status, created_at,
          payments(status, amount),
          attendance(checked_in_at, checked_in_by)
        `)
        .order("created_at", { ascending: false });

      const { data, error: fetchErr } = await query;
      if (fetchErr) {
        setError("Failed to load registrations. Check your permissions.");
        return;
      }

      const rows = (data as RegistrationRow[]) ?? [];
      // Ensure team_members is always an array
      for (const row of rows) {
        if (!Array.isArray(row.team_members)) {
          row.team_members = [];
        }
      }
      setRegistrations(rows);

      // Compute totals
      const checkedIn = rows.filter((r) => (r.attendance?.length ?? 0) > 0).length;
      const pendingPayment = rows.filter((r) =>
        r.payments?.some((p) => p.status === "pending" || p.status === "submitted_for_review")
      ).length;
      const verifiedPayment = rows.filter((r) =>
        r.payments?.some((p) => p.status === "verified")
      ).length;
      const internalTeams = rows.filter((r) => r.affiliation === "internal").length;
      const externalTeams = rows.filter((r) => r.affiliation === "external").length;
      setTotals({
        total: rows.length,
        internalTeams,
        externalTeams,
        pendingPayment,
        verifiedPayment,
        checkedIn,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Filter
  const filtered = registrations.filter((r) => {
    const searchLower = search.toLowerCase();
    const matchSearch =
      !search ||
      r.full_name.toLowerCase().includes(searchLower) ||
      r.email.toLowerCase().includes(searchLower) ||
      r.reference.toLowerCase().includes(searchLower) ||
      (r.team_name ?? "").toLowerCase().includes(searchLower);

    const matchAffil = filterAffiliation === "all" || r.affiliation === filterAffiliation;

    const payStatus = r.payments?.[0]?.status ?? "not_required";
    const matchPayment = filterPayment === "all" || payStatus === filterPayment;

    const isCheckedIn = (r.attendance?.length ?? 0) > 0;
    const matchCheckin =
      filterCheckin === "all" ||
      (filterCheckin === "checked_in" && isCheckedIn) ||
      (filterCheckin === "not_checked_in" && !isCheckedIn);

    return matchSearch && matchAffil && matchPayment && matchCheckin;
  });

  async function handleCheckIn(reg: RegistrationRow) {
    if (!user) return;
    const isCheckedIn = (reg.attendance?.length ?? 0) > 0;
    if (isCheckedIn) {
      setActionMessage({ type: "error", text: "Already checked in." });
      return;
    }
    setActionLoading(`checkin-${reg.id}`);
    setActionMessage(null);
    try {
      const { error: ciErr } = await supabase.from("attendance").insert({
        registration_id: reg.id,
        checked_in_by: user.id,
      });
      if (ciErr) {
        if (ciErr.code === "23505") {
          setActionMessage({ type: "error", text: "Already checked in (concurrent request)." });
        } else {
          setActionMessage({ type: "error", text: "Check-in failed. Please try again." });
        }
      } else {
        setActionMessage({ type: "success", text: `${reg.team_name || reg.full_name} checked in successfully.` });
        await fetchRegistrations();
        setSelected(null);
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleVerifyPayment(reg: RegistrationRow) {
    if (!isAdmin) {
      setActionMessage({ type: "error", text: "Only admins can verify payments." });
      return;
    }
    const payment = reg.payments?.[0];
    if (!payment) {
      setActionMessage({ type: "error", text: "No payment record found." });
      return;
    }
    if (payment.status === "verified") {
      setActionMessage({ type: "error", text: "Payment already verified." });
      return;
    }

    const confirmed = window.confirm(
      `Confirm payment verification for ${reg.team_name || reg.full_name} (${reg.reference})?\n\n` +
      "Only do this after checking payment evidence through the approved process. " +
      "This action is logged with your identity."
    );
    if (!confirmed) return;

    setActionLoading(`payment-${reg.id}`);
    setActionMessage(null);
    try {
      const { error: payErr } = await supabase
        .from("payments")
        .update({
          status: "verified",
          verified_by: user!.id,
          verified_at: new Date().toISOString(),
        })
        .eq("registration_id", reg.id);

      if (payErr) {
        setActionMessage({ type: "error", text: "Payment verification failed. Please try again." });
      } else {
        setActionMessage({ type: "success", text: `Payment verified for ${reg.team_name || reg.full_name}.` });
        await fetchRegistrations();
        setSelected(null);
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteTeam(reg: RegistrationRow) {
    if (!isAdmin) {
      setActionMessage({ type: "error", text: "Only admins can delete teams." });
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Delete team "${reg.team_name || reg.full_name}" (${reg.reference})?\n\n` +
      "This will permanently remove the team registration, including:\n" +
      "• All payment records\n" +
      "• All attendance records\n" +
      "• Uploaded files\n\n" +
      "This action cannot be undone."
    );
    if (!confirmed) return;

    setActionLoading(`delete-${reg.id}`);
    setActionMessage(null);
    try {
      // Delete the registration (cascades to payments, attendance via FK)
      const { error: delErr } = await supabase
        .from("registrations")
        .delete()
        .eq("id", reg.id);

      if (delErr) {
        setActionMessage({ type: "error", text: `Failed to delete team: ${delErr.message}` });
      } else {
        setActionMessage({ type: "success", text: `Team "${reg.team_name || reg.full_name}" deleted successfully.` });
        setSelected(null);
        await fetchRegistrations();
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExportCSV() {
    if (!isAdmin) return;
    setCsvLoading(true);
    try {
      const { data, error: csvErr } = await supabase
        .from("registrations")
        .select(
          "reference, team_name, full_name, email, phone, institution, affiliation, department, year_of_study, team_members, transaction_id, payment_screenshot_url, project_pdf_url, status, created_at"
        )
        .order("created_at", { ascending: true });

      if (csvErr || !data) {
        alert("Export failed. Please try again.");
        return;
      }

      const headers = [
        "Reference", "Team Name", "Team Lead", "Email", "Phone", "Institution",
        "Affiliation", "Department", "Year", "Team Members", "Transaction ID",
        "Payment Screenshot", "Project PDF", "Status", "Registered At"
      ];
      const rows = data.map((r: Record<string, unknown>) => {
        let membersStr = "";
        if (Array.isArray(r.team_members)) {
          membersStr = (r.team_members as Array<Record<string, string> | string>).map((m) => {
            if (typeof m === "string") return m;
            return `${m.name} (${m.email}, ${m.phone})`;
          }).join("; ");
        }
        return [
          r.reference as string,
          (r.team_name as string) ?? "",
          r.full_name as string,
          r.email as string,
          (r.phone as string) ?? "",
          r.institution as string,
          r.affiliation as string,
          (r.department as string) ?? "",
          (r.year_of_study as string) ?? "",
          membersStr,
          (r.transaction_id as string) ?? "",
          (r.payment_screenshot_url as string) ?? "",
          (r.project_pdf_url as string) ?? "",
          r.status as string,
          new Date(r.created_at as string).toLocaleString("en-IN"),
        ];
      });

      const csv = [headers, ...rows]
        .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `synex-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCsvLoading(false);
    }
  }

  /** Helper to display a team member (handles both old string[] and new object[] format) */
  function renderTeamMember(member: TeamMemberRecord | string, idx: number) {
    if (typeof member === "string") {
      return (
        <span key={idx} className="chip chip--draft">
          {member}
        </span>
      );
    }
    return (
      <div key={idx} className="admin-member-card">
        <span className="admin-member-name">{member.name}</span>
        <span className="admin-member-meta">{member.email}</span>
        <span className="admin-member-meta">{member.phone}</span>
      </div>
    );
  }

  return (
    <div>
      <h2 className="admin-section-title">Teams & Registrations</h2>

      {/* Summary cards */}
      <div className="admin-summary-cards">
        {[
          { label: "Total teams", value: totals.total },
          { label: "Internal (SIMATS)", value: `${totals.internalTeams}/20` },
          { label: "External", value: `${totals.externalTeams}/70` },
          { label: "Pending payment", value: totals.pendingPayment, accent: totals.pendingPayment > 0 },
          { label: "Verified", value: totals.verifiedPayment, accent: false },
          { label: "Checked in", value: totals.checkedIn },
        ].map((card) => (
          <div key={card.label} className="admin-summary-card">
            <span className="admin-summary-card-label">{card.label}</span>
            <span className={`admin-summary-card-value${card.accent ? " admin-summary-card-value--accent" : ""}`}>
              {loading ? "–" : card.value}
            </span>
          </div>
        ))}
      </div>

      {/* Action message */}
      {actionMessage && (
        <div
          className={`alert ${actionMessage.type === "success" ? "alert-success" : "alert-error"}`}
          role="alert"
          style={{ marginBottom: "var(--sp-4)" }}
        >
          {actionMessage.text}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setActionMessage(null)}
            style={{ marginLeft: "auto" }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Selected participant detail */}
      {selected && (
        <div className="admin-detail-panel" role="region" aria-label="Team detail">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--paper)" }}>
                {selected.team_name || selected.full_name}
              </h3>
              {selected.team_name && (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--paper-dim)", marginTop: "var(--sp-1)" }}>
                  Lead: {selected.full_name}
                </p>
              )}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelected(null)}
              aria-label="Close detail panel"
            >
              ×
            </button>
          </div>

          <div className="admin-detail-grid">
            {[
              { label: "Reference", value: selected.reference },
              { label: "Team name", value: selected.team_name ?? "—" },
              { label: "Team lead", value: selected.full_name },
              { label: "Email", value: selected.email },
              { label: "Phone", value: selected.phone ?? "—" },
              { label: "Institution", value: selected.institution },
              { label: "Affiliation", value: selected.affiliation },
              { label: "Department", value: selected.department ?? "—" },
              { label: "Year", value: selected.year_of_study ?? "—" },
              { label: "Status", value: selected.status },
              { label: "Registered", value: new Date(selected.created_at).toLocaleString("en-IN") },
              {
                label: "Payment",
                value: selected.payments?.[0]
                  ? PAYMENT_LABELS[selected.payments[0].status]
                  : "No record",
              },
              {
                label: "Check-in",
                value: selected.attendance?.[0]
                  ? `✓ ${new Date(selected.attendance[0].checked_in_at).toLocaleString("en-IN")}`
                  : "Not checked in",
              },
            ].map((item) => (
              <div key={item.label} className="admin-detail-item">
                <label>{item.label}</label>
                <span>{item.value}</span>
              </div>
            ))}
          </div>

          {/* External-specific: transaction ID and screenshot */}
          {selected.affiliation === "external" && (
            <div style={{ marginTop: "var(--sp-2)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              <div className="admin-detail-item">
                <label style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)",
                  color: "var(--paper-dim)", letterSpacing: "0.04em", display: "block",
                  marginBottom: "var(--sp-1)"
                }}>
                  Transaction ID
                </label>
                <span style={{
                  fontSize: "var(--text-sm)", color: "var(--accent)", fontFamily: "var(--font-mono)",
                  fontWeight: 600, letterSpacing: "0.02em"
                }}>
                  {selected.transaction_id || "—"}
                </span>
              </div>
              {selected.payment_screenshot_url && (
                <div>
                  <label style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)",
                    color: "var(--paper-dim)", letterSpacing: "0.04em", display: "block",
                    marginBottom: "var(--sp-2)"
                  }}>
                    Payment screenshot
                  </label>
                  <a
                    href={selected.payment_screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}
                  >
                    📸 View screenshot
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Internal-specific: project PDF */}
          {selected.affiliation === "internal" && selected.project_pdf_url && (
            <div style={{ marginTop: "var(--sp-2)" }}>
              <label style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)",
                color: "var(--paper-dim)", letterSpacing: "0.04em", display: "block",
                marginBottom: "var(--sp-2)"
              }}>
                Project PDF
              </label>
              <a
                href={selected.project_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}
              >
                📄 View project PDF
              </a>
            </div>
          )}

          {/* Team members display */}
          {selected.team_members.length > 0 && (
            <div style={{ marginTop: "var(--sp-2)" }}>
              <label style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)",
                color: "var(--paper-dim)", letterSpacing: "0.04em", display: "block",
                marginBottom: "var(--sp-2)"
              }}>
                Team members ({1 + selected.team_members.length} total)
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                {/* Lead */}
                <div className="admin-member-card" style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                  <span className="admin-member-name" style={{ color: "var(--accent)" }}>
                    {selected.full_name} (Lead)
                  </span>
                  <span className="admin-member-meta">{selected.email}</span>
                  <span className="admin-member-meta">{selected.phone ?? "—"}</span>
                </div>
                {/* Other members */}
                {selected.team_members.map((member, i) => renderTeamMember(member, i))}
              </div>
            </div>
          )}

          <div className="admin-action-row">
            {/* Check-in */}
            {(selected.attendance?.length ?? 0) > 0 ? (
              <span className="chip chip--verified">Already checked in</span>
            ) : (
              <button
                id={`btn-checkin-${selected.id}`}
                className="btn btn-primary btn-sm"
                disabled={!!actionLoading}
                onClick={() => handleCheckIn(selected)}
              >
                {actionLoading === `checkin-${selected.id}` ? (
                  <><span className="spinner" aria-hidden="true" /> Checking in…</>
                ) : "Check in"}
              </button>
            )}

            {/* Payment verification — admin only */}
            {isAdmin && selected.payments?.[0] && selected.payments[0].status !== "verified" && (
              <button
                id={`btn-verify-payment-${selected.id}`}
                className="btn btn-secondary btn-sm"
                disabled={!!actionLoading}
                onClick={() => handleVerifyPayment(selected)}
              >
                {actionLoading === `payment-${selected.id}` ? (
                  <><span className="spinner" aria-hidden="true" /> Verifying…</>
                ) : "Verify payment"}
              </button>
            )}

            {/* Delete team — admin only */}
            {isAdmin && (
              <button
                id={`btn-delete-${selected.id}`}
                className="btn btn-sm"
                style={{
                  background: "color-mix(in srgb, var(--signal) 12%, var(--ink-mid))",
                  color: "var(--signal)",
                  border: "1px solid color-mix(in srgb, var(--signal) 30%, transparent)",
                }}
                disabled={!!actionLoading}
                onClick={() => handleDeleteTeam(selected)}
              >
                {actionLoading === `delete-${selected.id}` ? (
                  <><span className="spinner" aria-hidden="true" /> Deleting…</>
                ) : "🗑 Delete team"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search & filters */}
      <div className="admin-search-bar">
        <div className="field" style={{ flex: "1 1 20rem" }}>
          <label htmlFor="admin-search" className="sr-only">Search registrations</label>
          <input
            id="admin-search"
            type="search"
            className="input"
            placeholder="Search by team, name, email, or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="filter-affil" className="sr-only">Filter by affiliation</label>
          <select id="filter-affil" className="input" value={filterAffiliation}
            onChange={(e) => setFilterAffiliation(e.target.value)}>
            <option value="all">All affiliations</option>
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="filter-payment" className="sr-only">Filter by payment status</label>
          <select id="filter-payment" className="input" value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}>
            <option value="all">All payment states</option>
            <option value="not_required">Not required</option>
            <option value="pending">Pending</option>
            <option value="submitted_for_review">Under review</option>
            <option value="verified">Verified</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="filter-checkin" className="sr-only">Filter by check-in</label>
          <select id="filter-checkin" className="input" value={filterCheckin}
            onChange={(e) => setFilterCheckin(e.target.value)}>
            <option value="all">All check-in states</option>
            <option value="checked_in">Checked in</option>
            <option value="not_checked_in">Not checked in</option>
          </select>
        </div>

        {isAdmin && (
          <button
            id="btn-export-csv"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            disabled={csvLoading}
          >
            {csvLoading ? "Exporting…" : "Export CSV"}
          </button>
        )}

        <button
          className="btn btn-ghost btn-sm"
          onClick={fetchRegistrations}
          aria-label="Refresh registrations"
        >
          ↺ Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: "var(--sp-4)" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="admin-table-wrap">
        {loading ? (
          <div style={{ padding: "var(--sp-8)", textAlign: "center" }}>
            <span className="spinner" aria-label="Loading" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--paper-dim)", fontSize: "var(--text-sm)" }}>
            {registrations.length === 0
              ? "No registrations yet."
              : "No registrations match your search or filters."}
          </div>
        ) : (
          <table className="data-table" aria-label="Registrations table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Team</th>
                <th>Lead</th>
                <th>Members</th>
                <th>Affiliation</th>
                <th>Payment</th>
                <th>Check-in</th>
                <th>Registered</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((reg) => {
                const payStatus = reg.payments?.[0]?.status ?? null;
                const isCheckedIn = (reg.attendance?.length ?? 0) > 0;
                const memberCount = 1 + (reg.team_members?.length ?? 0);
                return (
                  <tr key={reg.id}>
                    <td className="mono" style={{ fontSize: "var(--text-xs)" }}>{reg.reference}</td>
                    <td style={{ fontWeight: 500 }}>{reg.team_name || "—"}</td>
                    <td style={{ fontSize: "var(--text-sm)", color: "var(--paper-dim)" }}>{reg.full_name}</td>
                    <td>
                      <span className="chip chip--draft" style={{ fontSize: "var(--text-xs)" }}>
                        {memberCount} {memberCount === 1 ? "member" : "members"}
                      </span>
                    </td>
                    <td>
                      <span className="chip chip--draft" style={{ textTransform: "capitalize" }}>
                        {reg.affiliation}
                      </span>
                    </td>
                    <td>
                      {payStatus ? (
                        <span className={`chip ${PAYMENT_CHIP[payStatus]}`}>
                          {PAYMENT_LABELS[payStatus]}
                        </span>
                      ) : (
                        <span className="mono" style={{ color: "var(--paper-dim)", fontSize: "var(--text-xs)" }}>—</span>
                      )}
                    </td>
                    <td>
                      {isCheckedIn ? (
                        <span className="chip chip--verified">Checked in</span>
                      ) : (
                        <span className="mono" style={{ color: "var(--paper-dim)", fontSize: "var(--text-xs)" }}>No</span>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--paper-dim)", whiteSpace: "nowrap" }}>
                      {new Date(reg.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setSelected(reg);
                            setActionMessage(null);
                          }}
                          aria-label={`View details for ${reg.team_name || reg.full_name}`}
                        >
                          View
                        </button>
                        {isAdmin && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--signal)", fontSize: "var(--text-xs)" }}
                            onClick={() => handleDeleteTeam(reg)}
                            disabled={!!actionLoading}
                            aria-label={`Delete ${reg.team_name || reg.full_name}`}
                            title="Delete team"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--paper-dim)", marginTop: "var(--sp-3)" }}>
        Showing {filtered.length} of {registrations.length} teams
      </p>
    </div>
  );
}

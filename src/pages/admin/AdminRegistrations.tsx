import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "../../lib/supabaseAdmin";
import type { PaymentStatus, RegistrationStatus } from "../../lib/database.types";
import { useAuth } from "../../contexts/AuthContext";
import "./AdminDashboard.css";

interface RegistrationRow {
  id: string;
  reference: string;
  full_name: string;
  email: string;
  phone: string | null;
  institution: string;
  affiliation: string;
  department: string | null;
  year_of_study: string | null;
  status: RegistrationStatus;
  created_at: string;
  payments?: { status: PaymentStatus; amount: number | null }[];
  attendance?: { checked_in_at: string; checked_in_by: string }[];
}

interface Totals {
  total: number;
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
  const [totals, setTotals] = useState<Totals>({ total: 0, pendingPayment: 0, verifiedPayment: 0, checkedIn: 0 });
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
      let query = supabase
        .from("registrations")
        .select(`
          id, reference, full_name, email, phone, institution, affiliation,
          department, year_of_study, status, created_at,
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
      setRegistrations(rows);

      // Compute totals
      const checkedIn = rows.filter((r) => (r.attendance?.length ?? 0) > 0).length;
      const pendingPayment = rows.filter((r) =>
        r.payments?.some((p) => p.status === "pending" || p.status === "submitted_for_review")
      ).length;
      const verifiedPayment = rows.filter((r) =>
        r.payments?.some((p) => p.status === "verified")
      ).length;
      setTotals({ total: rows.length, pendingPayment, verifiedPayment, checkedIn });
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
      r.reference.toLowerCase().includes(searchLower);

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
        setActionMessage({ type: "success", text: `${reg.full_name} checked in successfully.` });
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
      `Confirm payment verification for ${reg.full_name} (${reg.reference})?\n\n` +
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
        setActionMessage({ type: "success", text: `Payment verified for ${reg.full_name}.` });
        await fetchRegistrations();
        setSelected(null);
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
          "reference, full_name, email, institution, affiliation, department, year_of_study, status, created_at"
        )
        .order("created_at", { ascending: true });

      if (csvErr || !data) {
        alert("Export failed. Please try again.");
        return;
      }

      const headers = [
        "Reference", "Full Name", "Email", "Institution",
        "Affiliation", "Department", "Year", "Status", "Registered At"
      ];
      const rows = data.map((r) => [
        r.reference,
        r.full_name,
        r.email,
        r.institution,
        r.affiliation,
        r.department ?? "",
        r.year_of_study ?? "",
        r.status,
        new Date(r.created_at).toLocaleString("en-IN"),
      ]);

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

  return (
    <div>
      <h2 className="admin-section-title">Registrations</h2>

      {/* Summary cards */}
      <div className="admin-summary-cards">
        {[
          { label: "Total", value: totals.total },
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
        <div className="admin-detail-panel" role="region" aria-label="Participant detail">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--paper)" }}>
              {selected.full_name}
            </h3>
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
            placeholder="Search by name, email, or reference…"
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
                <th>Name</th>
                <th>Email</th>
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
                return (
                  <tr key={reg.id}>
                    <td className="mono" style={{ fontSize: "var(--text-xs)" }}>{reg.reference}</td>
                    <td style={{ fontWeight: 500 }}>{reg.full_name}</td>
                    <td style={{ fontSize: "var(--text-sm)", color: "var(--paper-dim)" }}>{reg.email}</td>
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
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setSelected(reg);
                          setActionMessage(null);
                        }}
                        aria-label={`View details for ${reg.full_name}`}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--paper-dim)", marginTop: "var(--sp-3)" }}>
        Showing {filtered.length} of {registrations.length} registrations
      </p>
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AdminRegistrations from "./AdminRegistrations";
import AdminEventSettings from "./AdminEventSettings";
import AdminPaymentSettings from "./AdminPaymentSettings";
import "./AdminDashboard.css";

type AdminTab = "registrations" | "event-settings" | "payment-settings";

export default function AdminDashboard() {
  const { user, profile, signOut, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("registrations");
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
  }

  const tabs: { id: AdminTab; label: string; adminOnly: boolean }[] = [
    { id: "registrations", label: "Registrations", adminOnly: false },
    { id: "event-settings", label: "Event Settings", adminOnly: true },
    { id: "payment-settings", label: "Payment", adminOnly: true },
  ];

  return (
    <div className="admin-page" role="main">
      {/* Top bar */}
      <header className="admin-topbar" role="banner">
        <div className="admin-topbar-left">
          <span className="admin-wordmark">SYNEX</span>
          <span className="mono admin-role-badge">{profile?.role ?? "organizer"}</span>
        </div>
        <div className="admin-topbar-right">
          <span className="mono admin-user-email">
            {user?.email}
          </span>
          <button
            id="btn-admin-signout"
            className="btn btn-ghost btn-sm"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="admin-tabs" aria-label="Admin sections">
        {tabs
          .filter((t) => !t.adminOnly || isAdmin)
          .map((tab) => (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id}`}
              className={`admin-tab${activeTab === tab.id ? " admin-tab--active" : ""}`}
              aria-selected={activeTab === tab.id}
              role="tab"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
      </nav>

      {/* Tab content */}
      <div className="admin-content">
        {activeTab === "registrations" && <AdminRegistrations />}
        {activeTab === "event-settings" && isAdmin && <AdminEventSettings />}
        {activeTab === "payment-settings" && isAdmin && <AdminPaymentSettings />}
        {activeTab !== "registrations" && !isAdmin && (
          <div className="alert alert-error" role="alert">
            You do not have permission to access this section.
          </div>
        )}
      </div>
    </div>
  );
}

import { useAuth } from "../../contexts/AuthContext";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

/**
 * Admin route guard — shows login if no authenticated organizer session,
 * shows dashboard if the session includes an organizer_profiles record.
 */
export default function AdminPage() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--ink)",
        }}
        role="status"
        aria-label="Loading"
      >
        <span className="spinner" aria-hidden="true" style={{ width: "1.5rem", height: "1.5rem" }} />
      </div>
    );
  }

  if (!user || !profile) {
    return <AdminLogin />;
  }

  return <AdminDashboard />;
}

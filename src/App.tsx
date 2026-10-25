import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { EventSettingsProvider } from "./contexts/EventSettingsContext";
import PublicPage from "./pages/PublicPage";
import AdminPage from "./pages/admin/AdminPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <EventSettingsProvider>
          {/* Skip to main content for accessibility */}
          <a
            href="#main-content"
            className="btn btn-primary"
            style={{
              position: "fixed",
              top: "-100%",
              left: "var(--sp-4)",
              zIndex: 9999,
              transition: "top 0.1s",
            }}
            onFocus={(e) => {
              (e.target as HTMLAnchorElement).style.top = "var(--sp-4)";
            }}
            onBlur={(e) => {
              (e.target as HTMLAnchorElement).style.top = "-100%";
            }}
          >
            Skip to main content
          </a>

          <Routes>
            <Route path="/" element={<PublicPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/*" element={<AdminPage />} />
            <Route
              path="*"
              element={
                <div
                  style={{
                    minHeight: "100dvh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--sp-4)",
                    background: "var(--ink)",
                    color: "var(--paper)",
                    textAlign: "center",
                    padding: "var(--sp-6)",
                  }}
                >
                  <span className="mono" style={{ color: "var(--accent)", fontSize: "var(--text-3xl)", fontWeight: 700 }}>
                    404
                  </span>
                  <p style={{ color: "var(--paper-dim)" }}>Page not found.</p>
                  <a href="/" className="btn btn-secondary">
                    Back to SYNEX
                  </a>
                </div>
              }
            />
          </Routes>
        </EventSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

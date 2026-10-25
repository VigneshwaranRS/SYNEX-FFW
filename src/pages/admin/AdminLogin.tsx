import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import "./AdminLogin.css";

export default function AdminLogin() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn(email.trim().toLowerCase(), password);
    if (signInError) {
      setError(signInError);
    }
    setLoading(false);
  }

  return (
    <div className="admin-login-page" role="main">
      <div className="admin-login-box">
        <div className="admin-login-header">
          <span className="mono admin-login-label">AI Club / SYNEX</span>
          <h1 className="admin-login-title">Organizer access</h1>
          <p className="admin-login-sub">
            Authorized organizers only. Sign in with your provisioned account.
          </p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate aria-label="Admin sign-in form">
          <div className="field">
            <label htmlFor="admin-email">Email address</label>
            <input
              id="admin-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
              aria-required="true"
            />
          </div>

          <div className="field" style={{ marginTop: "var(--sp-4)" }}>
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              required
              aria-required="true"
            />
          </div>

          <button
            id="btn-admin-signin"
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: "var(--sp-6)", width: "100%" }}
            disabled={loading || !email || !password}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="admin-login-note mono">
          No self-registration. Contact the lead organizer to be provisioned.
        </p>
      </div>
    </div>
  );
}

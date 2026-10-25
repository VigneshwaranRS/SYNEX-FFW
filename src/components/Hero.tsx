import { useEventSettings } from "../contexts/EventSettingsContext";
import SignalMotif from "./SignalMotif";
import "./Hero.css";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Hero() {
  const { settings, loading } = useEventSettings();

  const hasDate = !!settings.eventDate;
  const hasVenue = !!settings.venueName;
  const isOpen = settings.registrationOpen;

  return (
    <section className="hero" id="about" aria-label="SYNEX hero">
      <div className="container hero-layout">
        {/* Left: text content */}
        <div className="hero-content">
          <div className="hero-meta">
            <span className="mono hero-org">AI Club</span>
            <span className="hero-sep" aria-hidden="true">/</span>
            <span className="mono hero-edition">Event 2026</span>
          </div>

          <h1 className="hero-wordmark" aria-label="SYNEX">
            SYNEX
          </h1>

          {loading ? (
            <div className="skeleton hero-tagline-skel" aria-hidden="true" />
          ) : (
            <p className="hero-tagline">{settings.tagline}</p>
          )}

          {/* Confirmed event info */}
          {!loading && (hasDate || hasVenue) && (
            <dl className="hero-facts">
              {hasDate && (
                <div className="hero-fact">
                  <dt className="label">Date</dt>
                  <dd className="hero-fact-val">{formatDate(settings.eventDate)}</dd>
                </div>
              )}
              {hasVenue && (
                <div className="hero-fact">
                  <dt className="label">Venue</dt>
                  <dd className="hero-fact-val">{settings.venueName}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="hero-actions">
            {!loading && isOpen ? (
              <a href="#register" className="btn btn-primary btn-lg">
                Register now
              </a>
            ) : !loading ? (
              <div className="hero-closed">
                <span className="chip chip--closed">Registration closed</span>
                <p className="hero-closed-note">
                  Check back for updates.
                </p>
              </div>
            ) : null}
            <a href="#details" className="btn btn-secondary">
              View details
            </a>
          </div>

          {/* Registration open badge */}
          {!loading && isOpen && (
            <p className="hero-open-note mono">
              <span className="status-dot status-dot--live" aria-hidden="true"/>
              Registration open
            </p>
          )}
        </div>

        {/* Right: signal motif illustration */}
        <div className="hero-illustration" aria-hidden="true">
          <SignalMotif className="hero-svg" />
        </div>
      </div>
    </section>
  );
}

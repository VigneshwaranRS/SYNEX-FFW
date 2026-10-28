import { useEventSettings } from "../contexts/EventSettingsContext";
import "./EventDetails.css";

function DetailRow({
  label,
  value,
  unconfirmed = false,
}: {
  label: string;
  value: React.ReactNode;
  unconfirmed?: boolean;
}) {
  return (
    <div className="detail-row">
      <dt className="label detail-label">{label}</dt>
      <dd className="detail-value">
        {unconfirmed ? (
          <span className="unconfirmed-notice">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
              <path d="M6 4v4M6 3v.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            Details will be announced
          </span>
        ) : value}
      </dd>
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  // Handle both YYYY-MM-DD and full ISO timestamps from the DB
  const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function EventDetails() {
  const { settings, loading } = useEventSettings();

  if (loading) {
    return (
      <section className="section event-details" id="details" aria-label="Event details">
        <div className="container">
          <div className="section-header">
            <span className="label">Details</span>
            <h2 className="section-title">Event information</h2>
          </div>
          <div className="details-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="detail-row">
                <div className="skeleton" style={{ width: 80, height: 12 }} />
                <div className="skeleton" style={{ width: 200, height: 16 }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const formattedDate = settings.eventDate ? formatDate(settings.eventDate) : null;
  const registrationStatus = settings.registrationOpen ? "open" : "closed";

  return (
    <section className="section event-details" id="details" aria-label="Event details">
      <div className="container">
        <div className="section-header">
          <span className="label">Details</span>
          <h2 className="section-title">Event information</h2>
        </div>

        <dl className="details-grid">
          <DetailRow
            label="Date"
            value={formattedDate || ""}
            unconfirmed={!formattedDate}
          />
          <DetailRow
            label="Start time"
            value={settings.eventStartTime || ""}
            unconfirmed={!settings.eventStartTime}
          />
          <DetailRow
            label="Venue"
            value={
              settings.venueName ? (
                <>
                  <span>{settings.venueName}</span>
                  {settings.venueAddress && (
                    <span className="detail-sub">{settings.venueAddress}</span>
                  )}
                  {settings.venueMapUrl && (
                    <a
                      href={settings.venueMapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="detail-link"
                    >
                      View map →
                    </a>
                  )}
                </>
              ) : ""
            }
            unconfirmed={!settings.venueName}
          />
          <DetailRow
            label="Format"
            value="In-person event"
            unconfirmed={false}
          />
          <DetailRow
            label="Eligibility"
            value={settings.eligibilityRules || ""}
            unconfirmed={!settings.eligibilityRules}
          />
          <DetailRow
            label="Registration"
            value={
              <span className={`chip chip--${registrationStatus}`}>
                {registrationStatus === "open" ? "Open" : "Closed"}
              </span>
            }
          />
          {settings.registrationDeadline && (
            <DetailRow
              label="Deadline"
              value={formatDate(settings.registrationDeadline)}
            />
          )}
          {settings.capacity && (
            <DetailRow
              label="Capacity"
              value={`${settings.capacity} participants`}
            />
          )}
        </dl>

        {/* Description */}
        {settings.shortDescription && (
          <div className="event-description">
            <p>{settings.shortDescription}</p>
          </div>
        )}

        {/* Program / Sessions */}
        <div className="program-section">
          <div className="section-header">
            <span className="label">Program</span>
            <h3 className="section-title">Schedule &amp; tracks</h3>
          </div>
          {settings.sessions.length === 0 ? (
            <p className="coming-soon-note">
              Program details will be announced once confirmed by the organizers.
            </p>
          ) : (
            <div className="sessions-list">
              {settings.sessions.map((session) => (
                <div key={session.id} className="session-card">
                  {session.track && (
                    <span className="mono session-track">{session.track}</span>
                  )}
                  <h4 className="session-title">{session.title}</h4>
                  {session.description && (
                    <p className="session-desc">{session.description}</p>
                  )}
                  {(session.startTime || session.endTime) && (
                    <p className="mono session-time">
                      {session.startTime} {session.endTime ? `→ ${session.endTime}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

import { useEventSettings } from "../contexts/EventSettingsContext";
import "./Footer.css";

export default function Footer() {
  const { settings } = useEventSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-wordmark">SYNEX</span>
          <span className="mono footer-org">AI Club</span>
        </div>

        <div className="footer-meta">
          {settings.contactEmail ? (
            <p className="footer-contact">
              <span className="label">Contact</span>
              <a
                href={`mailto:${settings.contactEmail}`}
                className="footer-email"
              >
                {settings.contactEmail}
              </a>
            </p>
          ) : (
            <p className="footer-contact">
              <span className="label">Contact</span>
              <span className="footer-unconf mono">Details will be announced</span>
            </p>
          )}

          {settings.eventDate && (
            <p className="footer-detail">
              <span className="label">Date</span>
              <span>{settings.eventDate}</span>
            </p>
          )}
        </div>

        <div className="footer-legal">
          <p className="mono footer-copy">
            © {year} AI Club · SYNEX. All rights reserved.
          </p>
          {settings.privacyNotice && (
            <p className="footer-privacy-notice">{settings.privacyNotice}</p>
          )}
          <p className="mono footer-data-note">
            Registration data is stored and used solely for organising SYNEX.
            Contact the organizers to request data deletion.
          </p>
        </div>
      </div>
    </footer>
  );
}

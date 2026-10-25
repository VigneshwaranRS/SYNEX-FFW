import { useState } from "react";
import { useEventSettings } from "../contexts/EventSettingsContext";
import "./FAQ.css";

export default function FAQ() {
  const { settings, loading } = useEventSettings();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (loading) {
    return (
      <section className="section faq-section" id="faq" aria-label="Frequently asked questions">
        <div className="container">
          <div className="section-header">
            <span className="label">FAQ</span>
            <h2 className="section-title">Common questions</h2>
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="faq-item">
              <div className="skeleton" style={{ height: 20, width: "60%" }} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="section faq-section" id="faq" aria-label="Frequently asked questions">
      <div className="container">
        <div className="section-header">
          <span className="label">FAQ</span>
          <h2 className="section-title">Common questions</h2>
        </div>

        {settings.faqs.length === 0 ? (
          <p className="coming-soon-note">
            FAQ entries will be published once the organizers have confirmed the answers.
          </p>
        ) : (
          <dl className="faq-list">
            {settings.faqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              const panelId = `faq-panel-${idx}`;
              const btnId = `faq-btn-${idx}`;
              return (
                <div key={faq.id} className="faq-item">
                  <dt>
                    <button
                      id={btnId}
                      className="faq-question"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenIndex(isOpen ? null : idx)}
                    >
                      <span>{faq.question}</span>
                      <span className="faq-chevron" aria-hidden="true">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                  </dt>
                  <dd
                    id={panelId}
                    role="region"
                    aria-labelledby={btnId}
                    className={`faq-answer${isOpen ? " faq-answer--open" : ""}`}
                    hidden={!isOpen}
                  >
                    <p>{faq.answer}</p>
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>
    </section>
  );
}

import { useState } from "react";
import { useEventSettings } from "../contexts/EventSettingsContext";
import "./FAQ.css";

/** Default FAQs — shown when the admin hasn't added any via the database */
const DEFAULT_FAQS = [
  {
    id: "default-1",
    question: "What is SYNEX?",
    answer:
      "SYNEX is the AI Club's flagship technology event at SIMATS. It brings together students from various colleges to collaborate, compete, and explore emerging technologies through hands-on activities and challenges.",
    displayOrder: 0,
  },
  {
    id: "default-2",
    question: "Who can participate in SYNEX?",
    answer:
      "SYNEX is open to both SIMATS students (internal) and students from other colleges (external). Internal teams are limited to 20 and external teams are limited to 50. Each team can have 1 to 4 members.",
    displayOrder: 1,
  },
  {
    id: "default-3",
    question: "How do I register my team?",
    answer:
      "Only the team lead needs to register. Fill out the registration form with your team name, your details, and add your team members' names. You'll receive a reference number — save it, as you'll need it at the event.",
    displayOrder: 2,
  },
  {
    id: "default-4",
    question: "Do all team members need to register individually?",
    answer:
      "No! Only the team lead registers for the entire team. You can add up to 3 additional team members (4 total including the lead) during registration. Each member's name will be recorded under your team's reference number.",
    displayOrder: 3,
  },
  {
    id: "default-5",
    question: "What email should SIMATS students use to register?",
    answer:
      "SIMATS students must register using their college email that ends with .simats@saveetha.com (for example, 192521307.simats@saveetha.com). External students can use any valid email address.",
    displayOrder: 4,
  },
  {
    id: "default-6",
    question: "Is there a registration fee?",
    answer:
      "Fee details will be announced by the organizers once confirmed. Check the registration section for the latest information on fees for internal and external participants.",
    displayOrder: 5,
  },
  {
    id: "default-7",
    question: "How many teams can participate?",
    answer:
      "There is a limit of 20 teams from SIMATS (internal) and 50 teams from other colleges (external). Registration is on a first-come, first-served basis, so register early to secure your spot!",
    displayOrder: 6,
  },
  {
    id: "default-8",
    question: "What should I bring to the event?",
    answer:
      "Bring your registration reference number, a valid student ID, and any materials specified by the organizers. Further details will be shared closer to the event date.",
    displayOrder: 7,
  },
];

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

  // Use database FAQs if available, otherwise fall back to defaults
  const faqs = settings.faqs.length > 0 ? settings.faqs : DEFAULT_FAQS;

  return (
    <section className="section faq-section" id="faq" aria-label="Frequently asked questions">
      <div className="container">
        <div className="section-header">
          <span className="label">FAQ</span>
          <h2 className="section-title">Common questions</h2>
        </div>

        <dl className="faq-list">
          {faqs.map((faq, idx) => {
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
      </div>
    </section>
  );
}

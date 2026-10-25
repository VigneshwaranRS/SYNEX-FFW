import Nav from "../components/Nav";
import Hero from "../components/Hero";
import EventDetails from "../components/EventDetails";
import RegistrationForm from "../components/RegistrationForm";
import FAQ from "../components/FAQ";
import Footer from "../components/Footer";
import { isSupabaseConfigured } from "../lib/config";

export default function PublicPage() {
  return (
    <>
      {!isSupabaseConfigured && (
        <div
          style={{
            background: "#1a1208",
            borderBottom: "1px solid #ffb300",
            padding: "0.6rem 1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            fontSize: "0.8125rem",
            color: "#ffb300",
            fontFamily: "JetBrains Mono, monospace",
            flexWrap: "wrap",
          }}
          role="banner"
          aria-label="Setup notice"
        >
          <span style={{ fontWeight: 600 }}>⚠ SETUP MODE</span>
          <span style={{ color: "#b8b3a0" }}>
            Supabase is not configured. Copy{" "}
            <code style={{ color: "#ffb300" }}>.env.example</code> →{" "}
            <code style={{ color: "#ffb300" }}>.env.local</code> and add your Supabase URL + anon key.
            Event content and registration will be live once connected.
          </span>
        </div>
      )}
      <Nav />
      <main id="main-content">
        <Hero />
        <EventDetails />
        <RegistrationForm />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}

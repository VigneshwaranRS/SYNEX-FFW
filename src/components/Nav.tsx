import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import "./Nav.css";

const NAV_LINKS = [
  { href: "/#about", label: "About" },
  { href: "/#details", label: "Details" },
  { href: "/#faq", label: "FAQ" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  return (
    <header className={`nav-header${scrolled ? " nav-header--scrolled" : ""}`} role="banner">
      <div className="container nav-inner">
        <Link to="/" className="nav-wordmark" aria-label="SYNEX — Home">
          SYNEX
        </Link>

        {/* Desktop links */}
        <nav className="nav-links" aria-label="Main navigation">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="nav-link">
              {l.label}
            </a>
          ))}
          <a href="/#register" className="btn btn-primary btn-sm nav-cta">
            Register
          </a>
        </nav>

        {/* Mobile toggle */}
        <button
          id="nav-menu-toggle"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="nav-mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="nav-toggle-icon" aria-hidden="true">
            {open ? (
              /* X icon */
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              /* Hamburger */
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </span>
        </button>
      </div>

      {/* Mobile menu */}
      <div
        id="nav-mobile-menu"
        ref={menuRef}
        className={`nav-mobile${open ? " nav-mobile--open" : ""}`}
        aria-hidden={!open}
      >
        <nav aria-label="Mobile navigation">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="nav-mobile-link"
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <a
            href="/#register"
            className="btn btn-primary nav-mobile-cta"
            tabIndex={open ? 0 : -1}
            onClick={() => setOpen(false)}
          >
            Register
          </a>
        </nav>
      </div>
    </header>
  );
}

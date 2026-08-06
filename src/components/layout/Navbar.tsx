import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronDown, Menu, X, Brain, BookOpen, HeartHandshake,
  ShieldCheck, Activity, Lock,
} from "lucide-react";
import { MindCareLogo } from "@/components/MindCareLogo";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface NavLink {
  label: string;
  /** If anchor, scroll to this section id on the landing page */
  anchor?: string;
  /** If route, navigate to this path */
  href?: string;
}

interface DropdownItem {
  label: string;
  desc: string;
  icon: React.ElementType;
  anchor?: string;
  href?: string;
  requiresAuth?: boolean;
}

// ─── Data ──────────────────────────────────────────────────────────────────────
const desktopLinks: NavLink[] = [
  { label: "Home",         anchor: "hero" },
  { label: "Features",     anchor: "features" },
  { label: "How It Works", anchor: "how-it-works" },
  { label: "About Us",     anchor: "about" },
];

const resourcesItems: DropdownItem[] = [
  {
    label: "AI Companion",
    desc: "Chat 24/7 with our empathetic AI",
    icon: Brain,
    anchor: "features",
  },
  {
    label: "Peer Companions",
    desc: "Anonymous, compassionate support",
    icon: HeartHandshake,
    href: "/companions",
    requiresAuth: true,
  },
  {
    label: "Licensed Therapists",
    desc: "Book professional consultations",
    icon: ShieldCheck,
    href: "/therapists",
    requiresAuth: true,
  },
  {
    label: "Wellness Articles",
    desc: "Guided reads & mental health tools",
    icon: BookOpen,
    href: "/resources",
    requiresAuth: true,
  },
  {
    label: "Mood Tracker",
    desc: "Track your daily wellness journey",
    icon: Activity,
    href: "/dashboard",
    requiresAuth: true,
  },
];

const mobileLinks: NavLink[] = [
  { label: "Home",         anchor: "hero" },
  { label: "Features",     anchor: "features" },
  { label: "How It Works", anchor: "how-it-works" },
  { label: "About Us",     anchor: "about" },
  { label: "Contact",      anchor: "footer" },
];

// ─── Smooth scroll helper ──────────────────────────────────────────────────────
function scrollToSection(sectionId: string) {
  if (sectionId === "hero") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const el = document.getElementById(sectionId);
  if (el) {
    const offset = 72; // navbar height
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function Navbar() {
  const [location, navigate] = useLocation();
  const isLanding = location === "/";

  const [mobileOpen, setMobileOpen]     = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [scrolled, setScrolled]         = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Scroll-aware shadow ─────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Active section via IntersectionObserver (landing only) ─────────────────
  useEffect(() => {
    if (!isLanding) return;
    const sectionIds = ["hero", "features", "how-it-works", "about", "footer"];
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = id === "hero" ? document.body : document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: "-60px 0px -50% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [isLanding]);

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setResourcesOpen(false);
    };
    if (resourcesOpen) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [resourcesOpen]);

  // ── Escape closes everything ────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMobileOpen(false); setResourcesOpen(false); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  // ── Close on route change ───────────────────────────────────────────────────
  useEffect(() => {
    setMobileOpen(false);
    setResourcesOpen(false);
  }, [location]);

  // ── Navigation handler ──────────────────────────────────────────────────────
  const handleNav = useCallback(
    (link: NavLink | DropdownItem, close?: () => void) => {
      close?.();
      setMobileOpen(false);
      setResourcesOpen(false);

      if ("requiresAuth" in link && link.requiresAuth && link.href) {
        navigate("/login");
        return;
      }
      if (link.anchor) {
        if (!isLanding) {
          // Navigate to landing first, then scroll after render
          navigate("/");
          setTimeout(() => scrollToSection(link.anchor!), 350);
        } else {
          scrollToSection(link.anchor);
        }
      } else if (link.href) {
        navigate(link.href);
      }
    },
    [isLanding, navigate]
  );

  const isActive = (link: NavLink) => {
    if (!isLanding) return false;
    return activeSection === (link.anchor ?? "");
  };

  return (
    <nav
      className={`sticky top-0 z-50 w-full bg-white transition-all duration-300 ${
        scrolled ? "shadow-[0_2px_20px_rgba(0,0,0,0.08)] border-b border-gray-100" : "border-b border-gray-100/50"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* ── Logo ─────────────────────────────────────────────────────── */}
          <button
            onClick={() => handleNav({ label: "Home", anchor: "hero" })}
            className="shrink-0 focus:outline-none"
            aria-label="Go to homepage"
          >
            <MindCareLogo size="sm" />
          </button>

          {/* ── Desktop Links ─────────────────────────────────────────────── */}
          <div className="hidden items-center gap-0.5 md:flex">
            {desktopLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNav(link)}
                className={`relative px-3.5 py-2 rounded-xl text-sm font-medium transition-colors duration-200 focus:outline-none ${
                  isActive(link)
                    ? "text-primary bg-primary/5 font-semibold"
                    : "text-gray-600 hover:text-primary hover:bg-gray-50"
                }`}
              >
                {link.label}
                {isActive(link) && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}

            {/* ── Resources Dropdown ─────────────────────────────────────── */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setResourcesOpen((p) => !p)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors duration-200 focus:outline-none ${
                  resourcesOpen
                    ? "text-primary bg-primary/5 font-semibold"
                    : "text-gray-600 hover:text-primary hover:bg-gray-50"
                }`}
                aria-haspopup="true"
                aria-expanded={resourcesOpen}
              >
                Resources
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${resourcesOpen ? "rotate-180 text-primary" : ""}`}
                />
              </button>

              <AnimatePresence>
                {resourcesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2.5 w-76 rounded-2xl border border-gray-100 bg-white shadow-2xl shadow-gray-200/70 overflow-hidden"
                    style={{ width: "304px" }}
                  >
                    <div className="p-2">
                      {resourcesItems.map((item) => (
                        <button
                          key={item.label}
                          onClick={() => handleNav(item)}
                          className="w-full flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-gray-50 group text-left"
                        >
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                            <item.icon className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 leading-tight flex items-center gap-1.5">
                              {item.label}
                              {item.requiresAuth && (
                                <Lock className="w-3 h-3 text-gray-400 shrink-0" />
                              )}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{item.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-gray-50 bg-gradient-to-r from-gray-50 to-white px-4 py-2.5">
                      <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                        <Lock className="w-3 h-3" />
                        <span>🔒 Locked items require a free account</span>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Desktop CTA ───────────────────────────────────────────────── */}
          <div className="hidden items-center gap-2 md:flex">
            <Button
              asChild
              variant="ghost"
              className="text-sm font-medium text-gray-700 hover:text-primary hover:bg-gray-50 rounded-xl h-9"
            >
              <Link href="/login">Sign In</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-sm shadow-primary/20 hover:bg-primary/90 h-9 transition-all hover:shadow-md hover:shadow-primary/25 hover:-translate-y-px"
            >
              <Link href="/register">Get Started</Link>
            </Button>
          </div>

          {/* ── Mobile Hamburger ──────────────────────────────────────────── */}
          <button
            className="flex items-center justify-center rounded-xl p-2 transition-colors hover:bg-gray-100 md:hidden focus:outline-none"
            onClick={() => setMobileOpen((p) => !p)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={mobileOpen ? "x" : "menu"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.13 }}
              >
                {mobileOpen
                  ? <X className="h-5 w-5 text-gray-700" />
                  : <Menu className="h-5 w-5 text-gray-700" />
                }
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* ── Mobile Drawer ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-gray-100 bg-white md:hidden"
          >
            {/* Main nav links */}
            <div className="px-3 pt-3 pb-2 space-y-0.5">
              {mobileLinks.map((link, i) => (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.18 }}
                >
                  <button
                    onClick={() => handleNav(link)}
                    className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors text-left ${
                      isActive(link)
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-primary"
                    }`}
                  >
                    {link.label}
                    {isActive(link) && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-2 w-2 rounded-full bg-primary"
                      />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Resources section */}
            <div className="px-3 pb-2">
              <p className="px-4 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Resources</p>
              <div className="space-y-0.5">
                {resourcesItems.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (mobileLinks.length + i) * 0.04, duration: 0.18 }}
                  >
                    <button
                      onClick={() => handleNav(item)}
                      className="w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-left transition-colors hover:bg-gray-50 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="flex items-center gap-1.5 text-gray-700 font-medium group-hover:text-primary transition-colors">
                        {item.label}
                        {item.requiresAuth && <Lock className="w-3 h-3 text-gray-400" />}
                      </span>
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* CTA buttons */}
            <div className="px-4 pb-5 pt-2 flex flex-col gap-2 border-t border-gray-50">
              <Button
                asChild
                variant="outline"
                className="w-full rounded-xl text-sm font-semibold border-gray-200 h-11"
              >
                <Link href="/login" onClick={() => setMobileOpen(false)}>Sign In</Link>
              </Button>
              <Button
                asChild
                className="w-full rounded-xl bg-primary text-sm font-semibold text-white h-11 shadow-md shadow-primary/20 hover:bg-primary/90"
              >
                <Link href="/register" onClick={() => setMobileOpen(false)}>Get Started Free →</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

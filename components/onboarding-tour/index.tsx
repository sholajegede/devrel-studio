"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "devrel-tour-v2";

interface TourStep {
  target: string;
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  highlight: boolean;
}

const STEPS: TourStep[] = [
  {
    target: "body",
    title: "Welcome to Your Performance Dashboard 👋",
    content:
      "Track every piece of DevRel content — articles, videos, events, podcasts, and packages — all in one place. Let's take a 60-second walkthrough.",
    position: "center",
    highlight: false,
  },
  {
    target: '[data-tour="stats-cards"]',
    title: "Your Key Metrics",
    content:
      "Five live numbers at the top: Published pieces, In Progress work, total Views (articles & videos), Downloads (packages & podcasts), and Attendees (events). All update in real time.",
    position: "bottom",
    highlight: true,
  },
  {
    target: '[data-tour="filter-bar"]',
    title: "Search & Filter",
    content:
      "Search by title, then narrow down by month, platform, or status. All filters stack together — click Clear to reset everything at once.",
    position: "bottom",
    highlight: true,
  },
  {
    target: '[data-tour="export-button"]',
    title: "Export as PDF",
    content:
      "Generate a clean PDF of the current filtered view — ideal for client check-ins, stakeholder updates, or keeping your own records.",
    position: "bottom",
    highlight: true,
  },
  {
    target: '[data-tour="category-pills"]',
    title: "Filter by Content Type",
    content:
      "Jump between Written, Video, Event, Podcast, Package, and Demo with one click. The count on each pill reflects how many pieces match your other active filters.",
    position: "bottom",
    highlight: true,
  },
  {
    target: '[data-tour="content-table"]',
    title: "Your Deliverables",
    content:
      "Content grouped by month, sorted by status. Each row shows the category type, platform, status, and the right metric for that content type — views, attendees, or downloads.",
    position: "top",
    highlight: true,
  },
  {
    target: '[data-tour="status-badge"]',
    title: "Content Status",
    content:
      "Published = live. In Review = waiting on a platform's editorial team (e.g. freeCodeCamp). Scheduled = dropping soon. Draft = still being written.",
    position: "bottom",
    highlight: true,
  },
  {
    target: '[data-tour="content-link"]',
    title: "Link & UTM Tracking",
    content:
      "Click View to open the live piece in a new tab. The UTM column holds your campaign tracking link — click Copy to grab it for reports or attribution.",
    position: "top",
    highlight: true,
  },
  {
    target: '[data-tour="share-button"]',
    title: "Reshare Tracking",
    content:
      "The share icon shows how many platforms this piece was reshared on. Click it to expand and see every reshare with a direct link — LinkedIn, Twitter/X, Reddit, Hacker News, and more.",
    position: "bottom",
    highlight: true,
  },
  {
    target: "body",
    title: "You're all set! ✨",
    content:
      "Restart this tour any time by clicking the Help button in the top right. Your DevRel Studio contact is always available for questions.",
    position: "center",
    highlight: false,
  },
];

interface OnboardingTourProps {
  onComplete?: () => void;
  autoStart?: boolean;
  onTourControlReady?: (controls: { startTour: () => void }) => void;
}

export function OnboardingTour({
  onComplete,
  autoStart = false,
  onTourControlReady,
}: OnboardingTourProps) {
  const [isActive,   setIsActive]   = useState(false);
  const [step,       setStep]       = useState(0);
  const [pos,        setPos]        = useState({ top: 0, left: 0 });
  const [visible,    setVisible]    = useState(false);
  const [hlBox,      setHlBox]      = useState<{
    top: number; left: number; width: number; height: number;
  } | null>(null);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTour = useCallback(() => {
    setStep(0);
    setVisible(false);
    setIsActive(true);
  }, []);

  // Expose startTour to parent once on mount
  useEffect(() => {
    onTourControlReady?.({ startTour });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start on first visit
  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (autoStart && !done) setTimeout(() => setIsActive(true), 600);
  }, [autoStart]);

  // Compute tooltip + highlight position
  const computePosition = useCallback(() => {
    const current = STEPS[step];
    const tooltip  = tooltipRef.current;
    if (!tooltip) return;

    const PAD = 16;
    const GAP = 12;
    const vW  = window.innerWidth;
    const vH  = window.innerHeight;
    const tW  = tooltip.offsetWidth;
    const tH  = tooltip.offsetHeight;

    const centerIt = () => {
      setPos({ top: Math.max(PAD, (vH - tH) / 2), left: Math.max(PAD, (vW - tW) / 2) });
      setHlBox(null);
      setVisible(true);
    };

    if (current.position === "center" || current.target === "body") {
      centerIt();
      return;
    }

    const el = document.querySelector(current.target);
    if (!el) { centerIt(); return; }

    const r = el.getBoundingClientRect();
    let top = 0;
    let left = 0;

    switch (current.position) {
      case "bottom": top = r.bottom + GAP;              left = r.left + r.width / 2 - tW / 2; break;
      case "top":    top = r.top - tH - GAP;            left = r.left + r.width / 2 - tW / 2; break;
      case "left":   top = r.top + r.height / 2 - tH / 2; left = r.left - tW - GAP;            break;
      case "right":  top = r.top + r.height / 2 - tH / 2; left = r.right + GAP;                break;
      default:       top = r.bottom + GAP;              left = r.left + r.width / 2 - tW / 2;
    }

    left = Math.max(PAD, Math.min(left, vW - tW - PAD));
    top  = Math.max(PAD, Math.min(top,  vH - tH - PAD));

    setPos({ top, left });

    if (current.highlight) {
      const ex = 8;
      setHlBox({ top: r.top - ex, left: r.left - ex, width: r.width + ex * 2, height: r.height + ex * 2 });
    } else {
      setHlBox(null);
    }

    setVisible(true);
  }, [step]);

  // Scroll to target then position tooltip
  useEffect(() => {
    if (!isActive) return;

    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);

    const current = STEPS[step];
    if (current.target !== "body" && current.position !== "center") {
      const el = document.querySelector(current.target);
      if (el) {
        const HEADER = 64;
        const MARGIN = 80;
        const rect   = el.getBoundingClientRect();
        window.scrollTo({ top: Math.max(0, rect.top + window.scrollY - HEADER - MARGIN), behavior: "smooth" });
      }
    }

    // Wait for scroll to settle before measuring
    timerRef.current = setTimeout(computePosition, 380);

    const onResize = () => {
      setVisible(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(computePosition, 120);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, step, computePosition]);

  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsActive(false);
    setStep(0);
    setVisible(false);
    onComplete?.();
  }, [onComplete]);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setVisible(false);
      setTimeout(() => setStep((s) => s + 1), 160);
    } else {
      complete();
    }
  }, [step, complete]);

  const prev = useCallback(() => {
    if (step > 0) {
      setVisible(false);
      setTimeout(() => setStep((s) => s - 1), 160);
    }
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")     complete();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft")  prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, next, prev, complete]);

  if (!isActive) return null;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <>
      {/* Overlay — box-shadow cutout for highlighted steps, solid overlay otherwise */}
      {hlBox ? (
        <div
          className="fixed z-[9999] pointer-events-none rounded-xl transition-all duration-300 ease-out"
          style={{
            top:    hlBox.top,
            left:   hlBox.left,
            width:  hlBox.width,
            height: hlBox.height,
            border: "2px solid hsl(var(--accent))",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
          }}
        />
      ) : (
        <div className="fixed inset-0 z-[9998] bg-black/70 pointer-events-none" />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="false"
        aria-label={current.title}
        className="fixed z-[10000] w-[400px] max-w-[calc(100vw-2rem)]"
        style={{
          top:       pos.top,
          left:      pos.left,
          opacity:   visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.18s ease, transform 0.18s ease",
        }}
      >
        <div className="bg-card border border-border/60 rounded-xl shadow-2xl overflow-hidden">
          {/* Accent stripe */}
          <div className="h-[3px] bg-gradient-to-r from-accent to-accent/20" />

          <div className="p-5">
            {/* Title + close */}
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <h3 className="text-[15px] font-semibold text-foreground leading-snug">
                {current.title}
              </h3>
              <button
                type="button"
                onClick={complete}
                className="shrink-0 mt-0.5 p-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Close tour"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Body */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {current.content}
            </p>

            {/* Segmented progress bar */}
            <div className="mb-1.5 flex gap-[3px]">
              {STEPS.map((_, i) => (
                <div key={i} className="flex-1 h-[3px] rounded-full bg-muted overflow-hidden">
                  <div
                    data-filled={i <= step}
                    className="h-full bg-accent rounded-full transition-all duration-300 data-[filled=true]:w-full data-[filled=false]:w-0"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/60 mb-4">
              {step + 1} / {STEPS.length}
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              {isFirst ? (
                <button
                  type="button"
                  onClick={complete}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Skip tour
                </button>
              ) : (
                <Button
                  onClick={prev}
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 -ml-1 text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              )}

              <Button onClick={next} size="sm" className="h-8 gap-1 px-4">
                {isLast ? "Done" : <><span>Next</span><ChevronRight className="h-3.5 w-3.5" /></>}
              </Button>
            </div>
          </div>
        </div>

        {/* Keyboard hint */}
        <p className="mt-2 text-center text-[11px] text-white/30 select-none pointer-events-none">
          ← → arrow keys · Esc to close
        </p>
      </div>
    </>
  );
}

export function TourTriggerButton({ onStartTour }: { onStartTour: () => void }) {
  return (
    <Button
      onClick={onStartTour}
      variant="ghost"
      size="sm"
      className="gap-2"
      title="Take a tour"
    >
      <HelpCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Help</span>
    </Button>
  );
}

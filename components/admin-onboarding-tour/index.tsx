"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEYS = {
  dashboard:  "devrel-admin-tour-v1",
  "add-entry":"devrel-add-entry-tour-v1",
  content:    "devrel-content-tour-v1",
  clients:    "devrel-clients-tour-v1",
  pipeline:   "devrel-pipeline-tour-v1",
  members:    "devrel-members-tour-v1",
  billing:    "devrel-billing-tour-v1",
  settings:   "devrel-settings-tour-v1",
} as const;

export type TourVariant = keyof typeof STORAGE_KEYS;

interface TourStep {
  target: string;
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  highlight: boolean;
}

// ── Dashboard overview ────────────────────────────────────────────────────────
const DASHBOARD_STEPS: TourStep[] = [
  { target: "body", title: "Your dashboard", content: "Live stats, a monthly chart and a filter for everything you have logged. This is where you workput.", position: "center", highlight: false },
  { target: '[data-tour="admin-stats"]', title: "The headline numbers", content: "Five counters, the same five your client sees: Published, In Progress, Views, Downloads and Attendees. They update the moment you add or edit an entry.", position: "bottom", highlight: true },
  { target: '[data-tour="admin-chart"]', title: "The monthly chart", content: "Published work against work in progress over six months. Slow months are easy to spotum to a new client.", position: "bottom", highlight: true },
  { target: '[data-tour="admin-filters"]', title: "Filter by month and category", content: "Narrow the page to one month or one category. Use it when you review a reporting period or auditing a single content type.", position: "bottom", highlight: true },
  { target: '[data-tour="admin-content"]', title: "Your work by month", content: "Entries group by month and sort by status. Your client sees the same rows without the edit controls.", position: "top", highlight: true },
  { target: '[data-tour="admin-add-button"]', title: "Add an entry", content: "Log an article, video, event, podcast, package or demo. The form changes to match the category you pick.", position: "bottom", highlight: true },
  { target: '[data-tour="admin-view-btn"]', title: "See the client view", content: "Open the read-only dashboard your client gets. Check it before a call.", position: "bottom", highlight: true },
  { target: "body", title: "That is the tour", content: "The sidebar moves you around. The Tour button in the top right starts this again.", position: "center", highlight: false },
];

// ── Add entry ─────────────────────────────────────────────────────────────────
const ADD_ENTRY_STEPS: TourStep[] = [
  { target: "body", title: "Adding an entry", content: "This form logs one piece of work. The fields change with the category you choose.", position: "center", highlight: false },
  { target: '[data-tour="form-category"]', title: "1. Pick a category", content: "Start here. The category sets which platforms, sub-types and metric fields appear below.", position: "bottom", highlight: true },
  { target: '[data-tour="form-details"]', title: "2. Fill in the details", content: "Client, title, platform, sub-type, date and status carry the entry. Metric fields appear on their own, basedcally for the chosen category.", position: "top", highlight: true },
  { target: '[data-tour="form-reshares"]', title: "3. Log reshares", content: "Record each place you promoted the piece. Your client can open the list on their dashboard.", position: "top", highlight: true },
  { target: '[data-tour="form-tags"]', title: "4. Add tags", content: "Tags make filtering faster. Click a suggestion or type your own.", position: "top", highlight: true },
  { target: '[data-tour="form-actions"]', title: "5. Save it", content: "Add Entry saves the work. It reaches the client dashboard at once.", position: "top", highlight: true },
  { target: "body", title: "Done", content: "Saving returns you to the content list. The Tour button starts this again.", position: "center", highlight: false },
];

// ── All Content ───────────────────────────────────────────────────────────────
const CONTENT_STEPS: TourStep[] = [
  { target: "body", title: "All your work", content: "Every entry you have logged, across all clients, categories and dates.", position: "center", highlight: false },
  { target: '[data-tour="content-filters"]', title: "Stack the filters", content: "Search by keyword. Then narrow by category, status, platform or client. They stack, so you can cut this to one reporting.", position: "bottom", highlight: true },
  { target: '[data-tour="content-table"]', title: "The table", content: "One row per entry. Each carries the category, platform, status, metric and a link to the live piece.", position: "top", highlight: true },
  { target: '[data-tour="content-add"]', title: "Add from here", content: "This page has its own Add button, so you can log work without going back.", position: "bottom", highlight: true },
  { target: "body", title: "One tip", content: "Clear filters resets the lot. The entry count tracks whatever the filters leave.", position: "center", highlight: false },
];

// ── Clients ───────────────────────────────────────────────────────────────────
const CLIENTS_STEPS: TourStep[] = [
  { target: "body", title: "Your clients", content: "Every engagement in one list, with the retainer, the start date and who to contact.", position: "center", highlight: false },
  { target: '[data-tour="clients-stats"]', title: "What you earn", content: "Active clients, total monthly retainer and the average. Three numbers.", position: "bottom", highlight: true },
  { target: '[data-tour="clients-add"]', title: "Add a client", content: "The form takes company, email, retainer, contract type and start date. Only the name is required.", position: "bottom", highlight: true },
  { target: '[data-tour="clients-list"]', title: "The cards", content: "Each card carries the status, the monthly retainer, the contract type and the start date. Click the menu to edit or delete.", position: "top", highlight: true },
  { target: "body", title: "How clients link to work", content: "Each card shows a slug, such as 'kinde'. Type that same slug in the Client field when you log an entry. Keeping everything connected.", position: "center", highlight: false },
];

// ── Pipeline ──────────────────────────────────────────────────────────────────
const PIPELINE_STEPS: TourStep[] = [
  { target: "body", title: "Your pipeline", content: "Work in flight, as a board. Four lanes by status. Stuck work stands out without reading a table.", position: "center", highlight: false },
  { target: '[data-tour="pipeline-summary"]', title: "What needs attention", content: "How much work is in flight, how much has slipped past its planned date, and what falls due in the next two weeks.", position: "bottom", highlight: true },
  { target: '[data-tour="pipeline-filter"]', title: "Focus on one client", content: "This cuts the board to a single client. Handy before a check-in call. It appears once you have more than one client.", position: "bottom", highlight: true },
  { target: '[data-tour="pipeline-board"]', title: "Four lanes", content: "Draft, Waiting Approval, Scheduled and Published. Each card carries the client, the platform and the planned date. Anything overdue turns amber.", position: "top", highlight: true },
  { target: '[data-tour="pipeline-card"]', title: "Move work along", content: "Open a card menu and pick a lane. It saves at once. You never open the full edit form.", position: "right", highlight: true },
  { target: "body", title: "That is the board", content: "The Tour button in the top right starts this again.", position: "center", highlight: false },
];

// ── Members ───────────────────────────────────────────────────────────────────
const MEMBERS_STEPS: TourStep[] = [
  { target: "body", title: "Your team", content: "This page controls who reaches your workspace. You own it, so you keep full control.", position: "center", highlight: false },
  { target: '[data-tour="members-invite"]', title: "Invite someone", content: "Enter an email and pick a role. We send the invite at once. Opening the link takes them through creating an account if needed.", position: "top", highlight: true },
  { target: '[data-tour="members-roles"]', title: "Three roles", content: "Admin does everything. Editor adds and edits work but deletes nothing. Viewer only reads the dashboard.", position: "top", highlight: true },
  { target: '[data-tour="members-seats"]', title: "Seats", content: "Your plan sets the seat count. Agency raises this workspace to 5.", position: "top", highlight: true },
];

// ── Billing ───────────────────────────────────────────────────────────────────
const BILLING_STEPS: TourStep[] = [
  { target: "body", title: "Billing", content: "How long your access runs, and how to extend it. Prices are monthly. You pay by bank transfer.", position: "center", highlight: false },
  { target: '[data-tour="billing-plan"]', title: "Your plan", content: "The plan you are on, what it includes, and the date access runs to. A free trial lasts 14 days.", position: "bottom", highlight: true },
  { target: '[data-tour="billing-plans"]', title: "The plans", content: "Starter $29, Pro $59, Agency $119 a month. Buy 1, 3, 6 or 12 months at a time. Longer terms cost less.", position: "top", highlight: true },
  { target: '[data-tour="billing-receipts"]', title: "Payment record", content: "Each payment lands here with the date it cleared and the date access runs to.", position: "top", highlight: true },
];

// ── Settings ──────────────────────────────────────────────────────────────────
const SETTINGS_STEPS: TourStep[] = [
  { target: "body", title: "Settings", content: "Your profile, your theme and your public handle.", position: "center", highlight: false },
  { target: '[data-tour="settings-profile"]', title: "Your profile", content: "Change your display name here. Kinde owns your email address, so change that with Kinde.", position: "bottom", highlight: true },
  { target: '[data-tour="settings-preferences"]', title: "Preferences", content: "Pick a theme. System follows your machine and changes with it.", position: "top", highlight: true },
  { target: '[data-tour="settings-danger"]', title: "Danger zone", content: "Deleting your account wipes every entry with it and nothing comes back. We ask you to confirm before anything is deleted.", position: "top", highlight: true },
];

// ── Step map ──────────────────────────────────────────────────────────────────
const STEPS_MAP: Record<TourVariant, TourStep[]> = {
  dashboard:  DASHBOARD_STEPS,
  "add-entry":ADD_ENTRY_STEPS,
  content:    CONTENT_STEPS,
  clients:    CLIENTS_STEPS,
  pipeline:   PIPELINE_STEPS,
  members:    MEMBERS_STEPS,
  billing:    BILLING_STEPS,
  settings:   SETTINGS_STEPS,
};

// ── Component ─────────────────────────────────────────────────────────────────

interface AdminTourProps {
  variant: TourVariant;
  onComplete?: () => void;
  autoStart?: boolean;
  onTourControlReady?: (controls: { startTour: () => void }) => void;
}

export function AdminTour({ variant, onComplete, autoStart = false, onTourControlReady }: AdminTourProps) {
  const STEPS       = STEPS_MAP[variant];
  const STORAGE_KEY = STORAGE_KEYS[variant];

  const [isActive, setIsActive] = useState(false);
  const [step,     setStep]     = useState(0);
  const [pos,      setPos]      = useState({ top: 0, left: 0 });
  const [visible,  setVisible]  = useState(false);
  const [hlBox,    setHlBox]    = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTour = useCallback(() => { setStep(0); setVisible(false); setIsActive(true); }, []);

  useEffect(() => { onTourControlReady?.({ startTour }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (autoStart && !done) setTimeout(() => setIsActive(true), 700);
  }, [autoStart, STORAGE_KEY]);

  const computePosition = useCallback(() => {
    const current = STEPS[step];
    const tooltip  = tooltipRef.current;
    if (!tooltip) return;
    const PAD = 16, GAP = 12;
    const vW = window.innerWidth, vH = window.innerHeight;
    const tW = tooltip.offsetWidth, tH = tooltip.offsetHeight;

    const centerIt = () => { setPos({ top: Math.max(PAD, (vH - tH) / 2), left: Math.max(PAD, (vW - tW) / 2) }); setHlBox(null); setVisible(true); };
    if (current.position === "center" || current.target === "body") { centerIt(); return; }

    const el = document.querySelector(current.target);
    if (!el) { centerIt(); return; }
    const r = el.getBoundingClientRect();
    let top = 0, left = 0;

    switch (current.position) {
      case "bottom": top = r.bottom + GAP; left = r.left + r.width / 2 - tW / 2; break;
      case "top":    top = r.top - tH - GAP; left = r.left + r.width / 2 - tW / 2; break;
      case "left":   top = r.top + r.height / 2 - tH / 2; left = r.left - tW - GAP; break;
      case "right":  top = r.top + r.height / 2 - tH / 2; left = r.right + GAP; break;
      default:       top = r.bottom + GAP; left = r.left + r.width / 2 - tW / 2;
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
  }, [step, STEPS]);

  useEffect(() => {
    if (!isActive) return;
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    const current = STEPS[step];
    if (current.target !== "body" && current.position !== "center") {
      const el = document.querySelector(current.target);
      if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 144), behavior: "smooth" });
    }
    timerRef.current = setTimeout(computePosition, 380);
    const onResize = () => { setVisible(false); if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(computePosition, 120); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isActive, step, STEPS, computePosition]);

  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsActive(false); setStep(0); setVisible(false);
    onComplete?.();
  }, [onComplete, STORAGE_KEY]);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) { setVisible(false); setTimeout(() => setStep((s) => s + 1), 160); } else { complete(); }
  }, [step, STEPS.length, complete]);

  const prev = useCallback(() => {
    if (step > 0) { setVisible(false); setTimeout(() => setStep((s) => s - 1), 160); }
  }, [step]);

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") complete();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
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
      {hlBox ? (
        <div
          className="fixed z-[9999] pointer-events-none rounded-xl transition-all duration-300 ease-out"
          style={{ top: hlBox.top, left: hlBox.left, width: hlBox.width, height: hlBox.height, border: "2px solid hsl(var(--accent))", boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)" }}
        />
      ) : (
        <div className="fixed inset-0 z-[9998] bg-black/70 pointer-events-none" />
      )}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="false"
        aria-label={current.title}
        className="fixed z-[10000] w-[400px] max-w-[calc(100vw-2rem)]"
        style={{ top: pos.top, left: pos.left, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)", transition: "opacity 0.18s ease, transform 0.18s ease" }}
      >
        <div className="bg-card border border-border/60 rounded-xl shadow-2xl overflow-hidden">
          <div className="h-[3px] bg-linear-to-r from-accent to-accent/20" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <h3 className="text-[15px] font-semibold text-foreground leading-snug">{current.title}</h3>
              <button type="button" onClick={complete} className="shrink-0 mt-0.5 p-1 rounded-md hover:bg-muted transition-colors" aria-label="Close tour">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-5">{current.content}</p>

            <div className="mb-1.5 flex gap-[3px]">
              {STEPS.map((_, i) => (
                <div key={i} className="flex-1 h-[3px] rounded-full bg-muted overflow-hidden">
                  <div data-filled={i <= step} className="h-full bg-accent rounded-full transition-all duration-300 data-[filled=true]:w-full data-[filled=false]:w-0" />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/60 mb-4">{step + 1} / {STEPS.length}</p>

            <div className="flex items-center justify-between">
              {isFirst ? (
                <button type="button" onClick={complete} className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1">Skip tour</button>
              ) : (
                <Button onClick={prev} variant="ghost" size="sm" className="h-8 gap-1 -ml-1 text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </Button>
              )}
              <Button onClick={next} size="sm" className="h-8 gap-1 px-4 bg-accent text-accent-foreground hover:bg-accent/90">
                {isLast ? "Done" : <><span>Next</span><ChevronRight className="h-3.5 w-3.5" /></>}
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-white/30 select-none pointer-events-none">← → arrow keys · Esc to close</p>
      </div>
    </>
  );
}

export function AdminTourTriggerButton({ onStartTour }: { onStartTour: () => void }) {
  return (
    <Button type="button" onClick={onStartTour} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" title="Take a tour of this page">
      <HelpCircle className="h-4 w-4" />
      <span className="hidden sm:inline text-xs">Tour</span>
    </Button>
  );
}

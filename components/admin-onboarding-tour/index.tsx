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
  { target: "body", title: "Your Admin Dashboard", content: "Command central — live stats, a monthly bar chart, and a filterable content view. Everything you need to track your DevRel output.", position: "center", highlight: false },
  { target: '[data-tour="admin-stats"]', title: "Live Performance Stats", content: "Five counters mirroring your client dashboard exactly: Published, In Progress, Views, Downloads, and Attendees. They update the moment you add or edit an entry.", position: "bottom", highlight: true },
  { target: '[data-tour="admin-chart"]', title: "Monthly Bar Chart", content: "Published vs in-progress content across the last 6 months. Great for spotting slow periods or showing momentum to a new client.", position: "bottom", highlight: true },
  { target: '[data-tour="admin-filters"]', title: "Filter by Month & Category", content: "Narrow down by month and content category. Useful when reviewing a specific reporting period or auditing a single content type.", position: "bottom", highlight: true },
  { target: '[data-tour="admin-content"]', title: "Monthly Content View", content: "Entries grouped by month, sorted by status. Same data your client sees, with edit access added for you.", position: "top", highlight: true },
  { target: '[data-tour="admin-add-button"]', title: "Add New Content", content: "Log a new blog, video, event, podcast, or package. The form adapts to whichever category you pick.", position: "bottom", highlight: true },
  { target: '[data-tour="admin-view-btn"]', title: "View the Client Dashboard", content: "Jump to the read-only client view to verify everything looks right before a check-in call.", position: "bottom", highlight: true },
  { target: "body", title: "You're all set!", content: "Use the sidebar to navigate. Restart this tour any time from the Tour button in the top-right.", position: "center", highlight: false },
];

// ── Add entry ─────────────────────────────────────────────────────────────────
const ADD_ENTRY_STEPS: TourStep[] = [
  { target: "body", title: "Adding a New Entry", content: "Log a single piece of DevRel content. Fields adapt based on the category you choose.", position: "center", highlight: false },
  { target: '[data-tour="form-category"]', title: "1. Pick a Category", content: "Always start here. Your selection controls which platforms, sub-types, and metric fields appear below.", position: "bottom", highlight: true },
  { target: '[data-tour="form-details"]', title: "2. Fill in the Details", content: "Client, title, platform, sub-type, date, and status are the core fields. Metric inputs appear automatically for the chosen category.", position: "top", highlight: true },
  { target: '[data-tour="form-reshares"]', title: "3. Log Reshares", content: "Record every platform where this piece was promoted. Clients can expand each reshare on their dashboard.", position: "top", highlight: true },
  { target: '[data-tour="form-tags"]', title: "4. Add Tags", content: "Tags make filtering faster. Click a suggestion or type a custom one.", position: "top", highlight: true },
  { target: '[data-tour="form-actions"]', title: "5. Save the Entry", content: "Click Add Entry to save. The entry appears on the client dashboard immediately.", position: "top", highlight: true },
  { target: "body", title: "All set!", content: "You'll land on the content list after saving. Restart this tour any time from the Tour button.", position: "center", highlight: false },
];

// ── All Content ───────────────────────────────────────────────────────────────
const CONTENT_STEPS: TourStep[] = [
  { target: "body", title: "All Content", content: "Your full content library — every entry across all clients, categories, and time periods.", position: "center", highlight: false },
  { target: '[data-tour="content-filters"]', title: "Combine Filters", content: "Search by keyword, then narrow by category, status, platform, or client. Use them together for precise reporting.", position: "bottom", highlight: true },
  { target: '[data-tour="content-table"]', title: "Your Content Library", content: "Every row is a logged entry. See the category badge, platform, status, metric, and a direct link to the live piece.", position: "top", highlight: true },
  { target: '[data-tour="content-add"]', title: "Quick Add", content: "The Add New Entry button is available here too — log content without going back to the overview.", position: "bottom", highlight: true },
  { target: "body", title: "Pro tip", content: "Use 'Clear filters' to reset everything at once. The entry count updates live so you always know how many results match.", position: "center", highlight: false },
];

// ── Clients ───────────────────────────────────────────────────────────────────
const CLIENTS_STEPS: TourStep[] = [
  { target: "body", title: "Client Management", content: "Your client roster — track every engagement, retainer, start date, and contact detail in one place.", position: "center", highlight: false },
  { target: '[data-tour="clients-stats"]', title: "Revenue Overview", content: "Active clients, combined monthly retainer, and average retainer at a glance — your book of business in three numbers.", position: "bottom", highlight: true },
  { target: '[data-tour="clients-add"]', title: "Add a Client", content: "Open the client form to fill in company, email, retainer amount, contract type, and start date. Only the name is required.", position: "bottom", highlight: true },
  { target: '[data-tour="clients-list"]', title: "Client Cards", content: "Each card shows status (Active, Paused, Ended), monthly retainer, contract type, and start date at a glance. Click the menu to edit or delete.", position: "top", highlight: true },
  { target: "body", title: "Linking clients to content", content: "The slug shown on each client card (e.g. 'kinde') is what you use in the Client field when logging content entries — keeping everything connected.", position: "center", highlight: false },
];

// ── Pipeline ──────────────────────────────────────────────────────────────────
const PIPELINE_STEPS: TourStep[] = [
  { target: "body", title: "Your Pipeline", content: "Everything in flight, as a board. Four lanes by status, so you can see what's stuck without reading a table.", position: "center", highlight: false },
  { target: '[data-tour="pipeline-summary"]', title: "What Needs Attention", content: "How many pieces are in flight, how many have slipped past their planned date, and what's due in the next two weeks.", position: "bottom", highlight: true },
  { target: '[data-tour="pipeline-filter"]', title: "Focus on One Client", content: "Filter the whole board down to a single client — useful right before a check-in call. Appears once you have more than one client.", position: "bottom", highlight: true },
  { target: '[data-tour="pipeline-board"]', title: "Four Lanes", content: "Draft, Waiting Approval, Scheduled, and Published. Cards show the client, platform, and planned date; anything overdue turns amber.", position: "top", highlight: true },
  { target: '[data-tour="pipeline-card"]', title: "Move Work Along", content: "Open a card's menu and pick a lane to change its status. It saves immediately — no need to open the full edit form.", position: "right", highlight: true },
  { target: "body", title: "That's the board", content: "Restart this tour any time from the Tour button in the top-right.", position: "center", highlight: false },
];

// ── Members ───────────────────────────────────────────────────────────────────
const MEMBERS_STEPS: TourStep[] = [
  { target: "body", title: "Team Members", content: "Manage who can access your workspace. You're the Owner and always have full control.", position: "center", highlight: false },
  { target: '[data-tour="members-invite"]', title: "Invite a Team Member", content: "Enter an email and choose a role. The invitation is sent instantly — they'll be prompted to create an account if needed.", position: "top", highlight: true },
  { target: '[data-tour="members-roles"]', title: "Three Permission Levels", content: "Admin: full access. Editor: add and edit content, no delete. Viewer: read-only access to the admin dashboard.", position: "top", highlight: true },
  { target: '[data-tour="members-seats"]', title: "Seat Usage", content: "Your current plan includes 1 seat. Upgrade to Agency to add up to 5 team members.", position: "top", highlight: true },
];

// ── Billing ───────────────────────────────────────────────────────────────────
const BILLING_STEPS: TourStep[] = [
  { target: "body", title: "Billing & Licensing", content: "Your access window and how to extend it. Priced monthly, bought in terms, paid by transfer.", position: "center", highlight: false },
  { target: '[data-tour="billing-plan"]', title: "Your Current Plan", content: "Shows your active license, included limits, and spend so far. You're on the Free Trial — unlimited time, limited entries.", position: "bottom", highlight: true },
  { target: '[data-tour="billing-plans"]', title: "Upgrade Options", content: "Starter $29, Pro $59, Agency $119 a month. Buy 1, 3, 6 or 12 months at a time — longer terms cost less.", position: "top", highlight: true },
  { target: '[data-tour="billing-receipts"]', title: "Receipts & License", content: "License key and downloadable invoices appear here after purchase. Download any time for accounting.", position: "top", highlight: true },
];

// ── Settings ──────────────────────────────────────────────────────────────────
const SETTINGS_STEPS: TourStep[] = [
  { target: "body", title: "Account Settings", content: "Manage your profile, preferences, and account security here.", position: "center", highlight: false },
  { target: '[data-tour="settings-profile"]', title: "Your Profile", content: "Update your display name. Your email is managed by Kinde and can't be changed from this page.", position: "bottom", highlight: true },
  { target: '[data-tour="settings-preferences"]', title: "Preferences", content: "Theme and notification preferences. Email notifications are coming soon.", position: "top", highlight: true },
  { target: '[data-tour="settings-danger"]', title: "Danger Zone", content: "Account deletion is permanent and removes all content data. We'll ask you to confirm before anything is deleted.", position: "top", highlight: true },
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

"use client";

import React, { use, useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  getMonthsFromContent,
  formatMonthLabel,
  getCategoryColor,
  CATEGORIES,
  STATUSES,
  type Category,
  type ContentEntry,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  ExternalLink,
  CheckCircle2,
  Clock,
  FileEdit,
  Copy,
  Calendar,
  Download,
  Loader2,
  CheckCheck,
  Share2,
  AlertCircle,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  FileText,
  Video,
  MapPin,
  Mic,
  Package,
  Users,
  Headphones,
  TrendingUp,
  Search,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  OnboardingTour,
  TourTriggerButton,
} from "@/components/onboarding-tour";

// ─── Category icon map ────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Written: FileText,
  Video:   Video,
  Event:   MapPin,
  Podcast: Mic,
  Package: Package,
};

const PLATFORM_FAVICONS: Record<string, string> = {
  LinkedIn:     "https://www.google.com/s2/favicons?domain=linkedin.com&sz=32",
  "Twitter/X":  "https://www.google.com/s2/favicons?domain=x.com&sz=32",
  "Hacker News":"https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=32",
  "Dev.to":     "https://www.google.com/s2/favicons?domain=dev.to&sz=32",
  Reddit:       "https://www.google.com/s2/favicons?domain=reddit.com&sz=32",
  YouTube:      "https://www.google.com/s2/favicons?domain=youtube.com&sz=32",
  GitHub:       "https://www.google.com/s2/favicons?domain=github.com&sz=32",
  freeCodeCamp: "https://www.google.com/s2/favicons?domain=freecodecamp.org&sz=32",
  Spotify:      "https://www.google.com/s2/favicons?domain=spotify.com&sz=32",
  "Apple Podcasts": "https://www.google.com/s2/favicons?domain=podcasts.apple.com&sz=32",
  npm:          "https://www.google.com/s2/favicons?domain=npmjs.com&sz=32",
};

// ─── Skeleton components ──────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/60 ${className ?? ""}`} />;
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SkeletonBlock className="h-4 w-20 mb-3" />
      <SkeletonBlock className="h-8 w-12" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr>
      <td className="px-4 py-4"><SkeletonBlock className="h-4 w-64 mb-1" /><SkeletonBlock className="h-4 w-40" /></td>
      <td className="px-4 py-4"><SkeletonBlock className="h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-4"><SkeletonBlock className="h-4 w-20" /></td>
      <td className="px-4 py-4"><SkeletonBlock className="h-6 w-24 rounded-full" /></td>
      <td className="px-4 py-4"><SkeletonBlock className="h-4 w-12" /></td>
      <td className="px-4 py-4"><SkeletonBlock className="h-4 w-10" /></td>
      <td className="px-4 py-4"><SkeletonBlock className="h-4 w-10" /></td>
    </tr>
  );
}

function DashboardSkeleton({ clientName }: { clientName: string }) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader clientName={clientName} />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="mb-6 flex items-center justify-between">
          <SkeletonBlock className="h-6 w-28" />
          <div className="flex gap-3">
            <SkeletonBlock className="h-9 w-44 rounded-md" />
            <SkeletonBlock className="h-9 w-32 rounded-md" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Title", "Type", "Platform", "Status", "Metric", "Link", "UTM"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...Array(4)].map((_, i) => <TableRowSkeleton key={i} />)}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function DashboardHeader({
  clientName,
  tourControls,
}: {
  clientName: string;
  tourControls?: { startTour: () => void } | null;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/images/devrel-logo.png" alt="DevRel Studio" width={32} height={32} className="rounded" />
            <div>
              <h1 className="text-base font-semibold text-foreground">
                devrel<span className="text-muted-foreground">.studio</span>
              </h1>
              <p className="text-xs text-muted-foreground">Performance Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tourControls && <TourTriggerButton onStartTour={tourControls.startTour} />}
            <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
              Client: {clientName}
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Metric cell — adapts to category ────────────────────────────────────────

function MetricCell({ entry }: { entry: ContentEntry }) {
  const cat = entry.category;

  if (cat === "Event") {
    return entry.attendees && entry.attendees > 0 ? (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {entry.attendees.toLocaleString()}
      </span>
    ) : (
      <span className="text-sm text-muted-foreground/50" title="Attendees not yet recorded">Pending</span>
    );
  }

  if (cat === "Podcast") {
    return entry.downloads && entry.downloads > 0 ? (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Headphones className="h-3.5 w-3.5" />
        {entry.downloads.toLocaleString()}
      </span>
    ) : (
      <span className="text-sm text-muted-foreground/50" title="Listener count not yet recorded">Pending</span>
    );
  }

  if (cat === "Package") {
    const hasData = (entry.downloads ?? 0) > 0 || (entry.weeklyDownloads ?? 0) > 0;
    return hasData ? (
      <div className="space-y-0.5">
        {(entry.weeklyDownloads ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            {entry.weeklyDownloads!.toLocaleString()}/wk
          </span>
        )}
        {(entry.downloads ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Download className="h-3 w-3" />
            {entry.downloads!.toLocaleString()} total
          </span>
        )}
      </div>
    ) : (
      <span className="text-sm text-muted-foreground/50" title="Downloads not yet recorded">Pending</span>
    );
  }

  // Written / Video — views
  return (entry.views ?? 0) > 0 ? (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Eye className="h-3.5 w-3.5" />
      {entry.views!.toLocaleString()}
    </span>
  ) : (
    <span className="text-sm text-muted-foreground/50" title="Views not yet recorded">Pending</span>
  );
}

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category?: Category }) {
  const cat = category ?? "Written";
  const Icon = CATEGORY_ICONS[cat] ?? FileText;
  return (
    <Badge variant="outline" className={`gap-1 text-xs ${getCategoryColor(cat)}`}>
      <Icon className="h-3 w-3" />
      {cat}
    </Badge>
  );
}

// ─── Status config ────────────────────────────────────────────────────────────

function getStatusConfig(status: string) {
  switch (status) {
    case "Published":
      return { icon: CheckCircle2, label: "Published", className: "bg-accent/10 text-accent border-accent/20" };
    case "Draft":
      return { icon: FileEdit, label: "Draft", className: "bg-stone-50 text-stone-600 border-stone-200" };
    case "Waiting Approval":
      return { icon: Clock, label: "In Review", className: "bg-amber-50 text-amber-700 border-amber-200" };
    case "Scheduled":
      return { icon: Calendar, label: "Scheduled", className: "bg-slate-50 text-slate-600 border-slate-200" };
    default:
      return { icon: Clock, label: status, className: "bg-stone-50 text-stone-600 border-stone-200" };
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientDashboard({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedMonth, setSelectedMonth] = useState<string>(
    searchParams.get("month") ?? "all"
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isTimeout, setIsTimeout] = useState(false);
  const [tourControls, setTourControls] = useState<{ startTour: () => void } | null>(null);

  const allContent = useQuery(api.content.getContentByClient, { client: subdomain });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (allContent === undefined) setIsTimeout(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [allContent]);

  const handleMonthChange = useCallback(
    (value: string) => {
      setSelectedMonth(value);
      setDateRange(undefined);
      const p = new URLSearchParams(searchParams.toString());
      if (value === "all") { p.delete("month"); } else { p.set("month", value); }
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from) {
      setSelectedMonth("all");
      const p = new URLSearchParams(searchParams.toString());
      p.delete("month");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
    if (range?.from && range?.to) setRangeOpen(false);
  };

  const clearDateRange = () => {
    setDateRange(undefined);
  };

  const formatRangeLabel = (range: DateRange) => {
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (range.from && range.to) return `${fmt(range.from)} – ${fmt(range.to)}`;
    if (range.from) return `From ${fmt(range.from)}`;
    return "Date Range";
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const ensureHttps = (url: string) => {
    if (!url) return "";
    return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
  };

  const clientName = subdomain.charAt(0).toUpperCase() + subdomain.slice(1);

  // ── Data derivation — all hooks must be called before any early return ────

  const content = useMemo(
    () =>
      allContent
        ? (allContent as ContentEntry[]).filter(
            (entry) => new Date(entry.publicationDate) >= new Date("2025-11-01")
          )
        : [],
    [allContent]
  );

  const months = useMemo(() => getMonthsFromContent(content), [content]);

  const availablePlatforms = useMemo(
    () => Array.from(new Set(content.map((e) => e.platform).filter(Boolean))).sort(),
    [content]
  );

  const applyTimeFilter = (result: ContentEntry[]) => {
    if (dateRange?.from) {
      const from = dateRange.from;
      const to = dateRange.to
        ? new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate(), 23, 59, 59, 999)
        : from;
      return result.filter((entry) => {
        const date = new Date(entry.publicationDate);
        return date >= from && date <= to;
      });
    }
    if (selectedMonth !== "all") {
      return result.filter((entry) => {
        const date = new Date(entry.publicationDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        return key === selectedMonth;
      });
    }
    return result;
  };

  // Feeds the top-level stat cards — time filter only
  const contentForStats = useMemo(
    () => applyTimeFilter([...content]),
    [content, selectedMonth, dateRange]
  );

  // Feeds the content table — all filters
  const contentForCounts = useMemo(() => {
    let result = applyTimeFilter([...content]);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => e.title.toLowerCase().includes(q));
    }
    if (platformFilter !== "all") result = result.filter((e) => e.platform === platformFilter);
    if (statusFilter !== "all")   result = result.filter((e) => e.status === statusFilter);
    return result;
  }, [content, selectedMonth, dateRange, searchQuery, platformFilter, statusFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: contentForCounts.length };
    for (const entry of contentForCounts) {
      const cat = entry.category ?? "Written";
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [contentForCounts]);

  const filteredContent = useMemo(() => {
    let result = contentForCounts;
    if (categoryFilter !== "all") {
      result = result.filter((e) => (e.category ?? "Written") === categoryFilter);
    }
    return result;
  }, [contentForCounts, categoryFilter]);

  // ── Loading / timeout states ──────────────────────────────────────────────

  if (allContent === undefined) {
    if (isTimeout) {
      return (
        <div className="min-h-screen bg-background">
          <DashboardHeader clientName={clientName} />
          <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">Taking longer than expected...</p>
                <p className="text-sm text-muted-foreground mt-1">The content is taking a while to load</p>
              </div>
              <Button onClick={() => router.refresh()} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </main>
        </div>
      );
    }
    return <DashboardSkeleton clientName={clientName} />;
  }

  const published   = contentForStats.filter((c) => c.status === "Published");
  const inProgress  = contentForStats.filter((c) => c.status !== "Published");
  const totalViews  = contentForStats
    .filter((c) => !c.category || c.category === "Written" || c.category === "Video")
    .reduce((sum, c) => sum + (c.views ?? 0), 0);
  const totalDownloads = contentForStats
    .filter((c) => c.category === "Package" || c.category === "Podcast")
    .reduce((sum, c) => sum + (c.downloads ?? 0), 0);
  const totalAttendees = contentForStats
    .filter((c) => c.category === "Event")
    .reduce((sum, c) => sum + (c.attendees ?? 0), 0);
  const totalReshares = contentForStats.reduce(
    (sum, c) => sum + (c.reshares?.length ?? 0), 0
  );

  const byMonth: Record<string, ContentEntry[]> = {};
  for (const entry of filteredContent) {
    const date = new Date(entry.publicationDate);
    const key = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(entry);
  }

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/export-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: subdomain,
          content: filteredContent,
          stats: { published: published.length, inProgress: inProgress.length, totalViews, totalReshares },
          month: selectedMonth === "all" ? null : selectedMonth,
        }),
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${subdomain}-content-report-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <OnboardingTour autoStart={true} onTourControlReady={(controls) => setTourControls(controls)} />
      <DashboardHeader clientName={clientName} tourControls={tourControls} />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Stat cards ── */}
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-5 gap-4" data-tour="stats-cards">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Published</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{published.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{inProgress.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Views</p>
            </div>
            <p className="text-3xl font-semibold text-foreground">
              {totalViews > 0 ? totalViews.toLocaleString() : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Downloads</p>
            </div>
            <p className="text-3xl font-semibold text-foreground">
              {totalDownloads > 0 ? totalDownloads.toLocaleString() : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Attendees</p>
            </div>
            <p className="text-3xl font-semibold text-foreground">
              {totalAttendees > 0 ? totalAttendees.toLocaleString() : "—"}
            </p>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="mb-6 space-y-4">

          {/* Row 1: search + secondary dropdowns + export */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center" data-tour="filter-bar">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search titles..."
                className="pl-9 bg-card h-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Month */}
              <Select value={selectedMonth} onValueChange={handleMonthChange} disabled={!!dateRange?.from}>
                <SelectTrigger className="w-full sm:w-36 bg-card h-9 text-sm">
                  <Calendar className="hidden sm:flex h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date range */}
              <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateRange?.from ? "secondary" : "outline"}
                    size="sm"
                    className="h-9 gap-1.5 text-sm font-normal bg-card"
                  >
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {dateRange?.from ? formatRangeLabel(dateRange) : "Date Range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarPicker
                    mode="range"
                    selected={dateRange}
                    onSelect={handleRangeSelect}
                    numberOfMonths={2}
                    initialFocus
                  />
                  {dateRange?.from && (
                    <div className="border-t p-2">
                      <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs" onClick={clearDateRange}>
                        <X className="h-3 w-3" />Clear range
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Platform */}
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-full sm:w-36 bg-card h-9 text-sm">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {availablePlatforms.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32 bg-card h-9 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear */}
              {([searchQuery, categoryFilter, platformFilter, statusFilter, selectedMonth].some(
                (v) => v && v !== "all"
              ) || !!dateRange?.from) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("all");
                    setPlatformFilter("all");
                    setStatusFilter("all");
                    setDateRange(undefined);
                    handleMonthChange("all");
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}

              {/* Export */}
              <Button
                onClick={exportToPDF}
                disabled={isExporting || filteredContent.length === 0}
                variant="default"
                size="sm"
                className="h-9 gap-2 shrink-0 ml-auto sm:ml-0"
                data-tour="export-button"
              >
                {isExporting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Exporting...</>
                ) : (
                  <><Download className="h-3.5 w-3.5" />Export PDF</>
                )}
              </Button>
            </div>
          </div>

          {/* ── Category pills — horizontal scroll on all screen sizes ── */}
          <div data-tour="category-pills" className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                categoryFilter === "all"
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              All
              <span className={`ml-1.5 text-xs tabular-nums ${categoryFilter === "all" ? "opacity-60" : "opacity-50"}`}>
                {categoryCounts.all ?? 0}
              </span>
            </button>
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat] ?? 0;
              if (count === 0) return null;
              const Icon = CATEGORY_ICONS[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    categoryFilter === cat
                      ? "bg-foreground text-background"
                      : "border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cat}
                  <span className={`text-xs tabular-nums ${categoryFilter === cat ? "opacity-60" : "opacity-50"}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

        </div>

        {/* ── Content tables by month ── */}
        <div className="space-y-8 mr-4 ml-4 sm:mr-0 sm:ml-0">
          {Object.entries(byMonth)
            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
            .map(([month, entries], monthIndex) => {
              const monthPublished = entries.filter((e) => e.status === "Published").length;
              const monthViews = entries
                .filter((e) => !e.category || e.category === "Written" || e.category === "Video")
                .reduce((sum, e) => sum + (e.views ?? 0), 0);
              const monthAttendees = entries
                .filter((e) => e.category === "Event")
                .reduce((sum, e) => sum + (e.attendees ?? 0), 0);
              const monthDownloads = entries
                .filter((e) => e.category === "Package" || e.category === "Podcast")
                .reduce((sum, e) => sum + (e.downloads ?? 0), 0);

              return (
                <section key={month}>
                  <div className="mb-4 flex items-start sm:items-center justify-between border-b border-border pb-2">
                    <h3 className="font-medium text-foreground whitespace-nowrap">{month}</h3>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-4 ml-auto">
                      {monthViews > 0 && (
                        <span className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                          <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          {monthViews.toLocaleString()} views
                        </span>
                      )}
                      {monthAttendees > 0 && (
                        <span className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                          <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          {monthAttendees.toLocaleString()} attendees
                        </span>
                      )}
                      {monthDownloads > 0 && (
                        <span className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                          <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          {monthDownloads.toLocaleString()} downloads
                        </span>
                      )}
                      <span className="text-muted-foreground hidden sm:inline-flex">|</span>
                      <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                        {monthPublished} of {entries.length} delivered
                      </span>
                    </div>
                  </div>

                  <div
                    className="overflow-x-auto -mx-4 sm:mx-0 sm:overflow-hidden rounded-lg border border-border bg-card"
                    data-tour={monthIndex === 0 ? "content-table" : undefined}
                  >
                    <table className="w-full min-w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Title</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Platform</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Metric</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Link</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">UTM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {entries
                          .sort((a, b) => {
                            const statusOrder: Record<string, number> = {
                              Published: 0, "Waiting Approval": 1, Draft: 2, Scheduled: 3,
                            };
                            const aOrder = statusOrder[a.status] ?? 4;
                            const bOrder = statusOrder[b.status] ?? 4;
                            if (aOrder !== bOrder) return aOrder - bOrder;
                            return new Date(a.publicationDate).getTime() - new Date(b.publicationDate).getTime();
                          })
                          .map((entry, entryIndex) => {
                            const statusConfig = getStatusConfig(entry.status);
                            const StatusIcon = statusConfig.icon;
                            const uniqueKey = entry._id || `${month}-${entryIndex}`;
                            const isExpanded = expandedRows.has(uniqueKey);
                            const entryHasReshares = entry.reshares && entry.reshares.length > 0;
                            const reshareCount = entry.reshares?.length ?? 0;
                            const isFirstEntry  = monthIndex === 0 && entryIndex === 0;
                            const isSecondEntry = monthIndex === 0 && entryIndex === 1;

                            return (
                              <React.Fragment key={uniqueKey}>
                                <tr className="hover:bg-muted/30 transition-colors">

                                  {/* Title + reshare toggle */}
                                  <td className="px-4 py-4">
                                    <div className="max-w-xs">
                                      <div className="flex items-start gap-2">
                                        <span className="font-medium text-foreground line-clamp-2">
                                          {entry.title}
                                        </span>
                                        <button
                                          onClick={() => toggleRowExpansion(uniqueKey)}
                                          className={`mt-4 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors
                                            ${entryHasReshares
                                              ? "bg-accent/10 text-accent hover:bg-accent/20"
                                              : "text-muted-foreground/40 hover:text-muted-foreground cursor-default"}
                                            ${isExpanded ? "bg-accent/20" : ""}
                                          `}
                                          title={entryHasReshares
                                            ? `${reshareCount} reshare${reshareCount > 1 ? "s" : ""}`
                                            : "No reshares yet"}
                                          data-tour={isFirstEntry ? "share-button" : undefined}
                                        >
                                          <Share2 className="h-3.5 w-3.5 shrink-0" />
                                          {entryHasReshares && (
                                            <span className="font-medium tabular-nums">{reshareCount}</span>
                                          )}
                                          {entryHasReshares && (
                                            isExpanded
                                              ? <ChevronUp className="h-2.5 w-2.5" />
                                              : <ChevronDown className="h-2.5 w-2.5" />
                                          )}
                                        </button>
                                      </div>
                                      {/* Event/Podcast extra context */}
                                      {entry.category === "Event" && entry.eventName && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {entry.eventName}{entry.eventLocation ? ` · ${entry.eventLocation}` : ""}
                                        </p>
                                      )}
                                      {entry.category === "Podcast" && entry.podcastName && (
                                        <p className="text-xs text-muted-foreground mt-1">{entry.podcastName}</p>
                                      )}
                                      {entry.category === "Package" && entry.packageName && (
                                        <p className="text-xs text-muted-foreground font-mono mt-1">{entry.packageName}</p>
                                      )}
                                    </div>
                                  </td>

                                  {/* Category badge */}
                                  <td className="px-4 py-4">
                                    <CategoryBadge category={entry.category} />
                                  </td>

                                  {/* Platform */}
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-1.5">
                                      {PLATFORM_FAVICONS[entry.platform] && (
                                        <img
                                          src={PLATFORM_FAVICONS[entry.platform]}
                                          alt={entry.platform}
                                          width={14}
                                          height={14}
                                          className="rounded-sm shrink-0"
                                        />
                                      )}
                                      <span className="text-sm text-muted-foreground">{entry.platform}</span>
                                    </div>
                                  </td>

                                  {/* Status */}
                                  <td className="px-4 py-4">
                                    <Badge
                                      variant="outline"
                                      className={`gap-1 text-xs ${statusConfig.className}`}
                                      data-tour={isFirstEntry ? "status-badge" : undefined}
                                    >
                                      <StatusIcon className="h-3 w-3" />
                                      {statusConfig.label}
                                    </Badge>
                                  </td>

                                  {/* Metric — adapts per category */}
                                  <td className="px-4 py-4">
                                    <MetricCell entry={entry} />
                                  </td>

                                  {/* Link */}
                                  <td className="px-4 py-4">
                                    {entry.link ? (
                                      <a
                                        href={entry.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                                        data-tour={isSecondEntry ? "content-link" : undefined}
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        View
                                      </a>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                  </td>

                                  {/* UTM copy */}
                                  <td className="px-4 py-4">
                                    {entry.trackingLink ? (
                                      <button
                                        onClick={() => copyToClipboard(entry.trackingLink!, uniqueKey)}
                                        className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                        title={entry.trackingLink}
                                      >
                                        {copiedId === uniqueKey ? (
                                          <><CheckCheck className="h-3.5 w-3.5 text-accent" /><span>Copied</span></>
                                        ) : (
                                          <><Copy className="h-3.5 w-3.5" /><span className="hidden sm:inline">Copy</span></>
                                        )}
                                      </button>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                  </td>
                                </tr>

                                {/* Reshare expansion — all categories */}
                                {isExpanded && (
                                  <tr className="bg-accent/5">
                                    <td colSpan={7} className="px-4 py-3">
                                      <div className="ml-8 space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                                          Reshared on:
                                        </p>
                                        {entryHasReshares ? (
                                          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                                            {entry.reshares!.map(
                                              (reshare: { platform: string; link: string; date: string }, idx: number) => (
                                                <div
                                                  key={idx}
                                                  className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border"
                                                >
                                                  <img
                                                    src={
                                                      PLATFORM_FAVICONS[reshare.platform] ??
                                                      `https://www.google.com/s2/favicons?domain=${reshare.platform.toLowerCase()}.com&sz=32`
                                                    }
                                                    alt={reshare.platform}
                                                    width={20}
                                                    height={20}
                                                    className="rounded-sm"
                                                  />
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground">{reshare.platform}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                      {new Date(reshare.date).toLocaleDateString("en-US", {
                                                        month: "short", day: "numeric", year: "numeric",
                                                      })}
                                                    </p>
                                                  </div>
                                                  <div className="flex items-center gap-2 shrink-0">
                                                    <a
                                                      href={ensureHttps(reshare.link)}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="p-1.5 hover:bg-muted rounded transition-colors"
                                                      title="Visit reshare"
                                                    >
                                                      <ExternalLink className="h-3.5 w-3.5 text-accent" />
                                                    </a>
                                                    <button
                                                      onClick={() => copyToClipboard(reshare.link, `${uniqueKey}-reshare-${idx}`)}
                                                      className="p-1.5 hover:bg-muted rounded transition-colors"
                                                      title="Copy link"
                                                    >
                                                      {copiedId === `${uniqueKey}-reshare-${idx}` ? (
                                                        <CheckCheck className="h-3.5 w-3.5 text-accent" />
                                                      ) : (
                                                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                                      )}
                                                    </button>
                                                  </div>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-center py-4">
                                            <div className="text-center">
                                              <Share2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                                              <p className="text-sm text-muted-foreground">No reshares yet for this piece</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
        </div>

        {filteredContent.length === 0 && (
          <div className="rounded-lg border border-border bg-card py-16 text-center">
            <p className="text-muted-foreground">No content found for this period.</p>
          </div>
        )}

        <footer className="mt-12 pt-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/assets/logo-dark.png" alt="DevRel Studio" width={20} height={20} className="rounded opacity-90" />
              <span className="text-sm text-muted-foreground">devrel.studio</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Updated{" "}
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

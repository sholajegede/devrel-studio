"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ContentEntry,
  Category,
  CATEGORIES,
  PLATFORMS_BY_CATEGORY,
  SUBTYPES_BY_CATEGORY,
  STATUSES,
  DEFAULT_TAGS,
  RESHARE_PLATFORMS,
  Reshare,
} from "@/lib/types";
import { CATEGORY_META } from "@/lib/category-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Link2,
  Eye,
  ExternalLink,
  Share2,
  Plus,
  Trash2,
  MapPin,
  Mic,
  Download,
  Users,
  Headphones,
  Hash,
  Github,
  Star,
  Layers,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserContext } from "@/contexts/user-context";
import Link from "next/link";

interface ContentFormProps {
  existingEntry?: ContentEntry;
  onSuccess?: () => void;
}

// ── Title label per category ──────────────────────────────────────────────────

function getTitleLabel(category: Category): string {
  switch (category) {
    case "Event":   return "Talk Title";
    case "Podcast": return "Episode Title";
    case "Package": return "Package Display Name";
    case "Demo":    return "Demo Name";
    default:        return "Post Title";
  }
}

export function ContentForm({ existingEntry, onSuccess }: ContentFormProps) {
  const { profile } = useUserContext();
  const router = useRouter();
  const isEditing = !!existingEntry;

  const createContent = useMutation(api.content.createContent);
  const updateContent = useMutation(api.content.updateContent);

  // The client dashboard resolves a slug to one client row, so an entry has to
  // be tagged with a slug that actually exists — hence the real client list
  // rather than a hardcoded one.
  const clients = useQuery(api.clients.getClients);

  // ── Category ──────────────────────────────────────────────────────────────

  const [category, setCategory] = useState<Category>(
    existingEntry?.category ?? "Written"
  );

  // ── Core form fields ──────────────────────────────────────────────────────

  const [formData, setFormData] = useState({
    client: existingEntry?.client || "",
    title: existingEntry?.title || "",
    link: existingEntry?.link || "",
    trackingLink: existingEntry?.trackingLink || "",
    platform: existingEntry?.platform || "",
    publicationDate: existingEntry?.publicationDate || "",
    status: existingEntry?.status || "",
    views: existingEntry?.views?.toString() || "0",
    contentType: existingEntry?.contentType || "",
    notes: existingEntry?.notes || "",
    // Package
    packageName: existingEntry?.packageName || "",
    downloads: existingEntry?.downloads?.toString() || "0",
    weeklyDownloads: existingEntry?.weeklyDownloads?.toString() || "0",
    // Event
    eventName: existingEntry?.eventName || "",
    eventLocation: existingEntry?.eventLocation || "",
    attendees: existingEntry?.attendees?.toString() || "0",
    // Podcast
    podcastName: existingEntry?.podcastName || "",
    // Demo
    repoUrl: existingEntry?.repoUrl || "",
    stack: existingEntry?.stack || "",
    stars: existingEntry?.stars?.toString() || "0",
  });

  const [selectedTags, setSelectedTags] = useState<string[]>(
    existingEntry?.tags || []
  );
  const [customTag, setCustomTag] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [reshares, setReshares] = useState<Reshare[]>(
    existingEntry?.reshares || []
  );
  const [newReshare, setNewReshare] = useState({ platform: "", link: "", date: "" });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    // Reset category-specific fields and platform when switching
    setFormData((prev) => ({
      ...prev,
      platform: "",
      contentType: "",
      packageName: "",
      downloads: "0",
      weeklyDownloads: "0",
      eventName: "",
      eventLocation: "",
      attendees: "0",
      podcastName: "",
      repoUrl: "",
      stack: "",
      stars: "0",
    }));
    setErrors({});
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const addTag = (tag: string) => {
    if (tag && !selectedTags.includes(tag)) setSelectedTags((prev) => [...prev, tag]);
    setCustomTag("");
  };

  const removeTag = (tag: string) =>
    setSelectedTags((prev) => prev.filter((t) => t !== tag));

  const addReshare = () => {
    if (newReshare.platform && newReshare.link) {
      setReshares((prev) => [
        ...prev,
        { ...newReshare, date: newReshare.date || new Date().toISOString().split("T")[0] },
      ]);
      setNewReshare({ platform: "", link: "", date: "" });
    }
  };

  const removeReshare = (index: number) =>
    setReshares((prev) => prev.filter((_, i) => i !== index));

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.title.trim())     e.title = "Title is required";
    if (!formData.publicationDate)  e.publicationDate = "Date is required";
    if (!formData.status)           e.status = "Status is required";
    if (!formData.contentType)      e.contentType = "Sub-type is required";
    if (category !== "Event" && category !== "Demo" && !formData.platform) e.platform = "Platform is required";
    if (category === "Demo" && !formData.repoUrl.trim()) e.repoUrl = "GitHub repo link is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate() || !profile?._id) return;

    const base = {
      client: formData.client || "",
      category,
      title: formData.title,
      link: formData.link,
      trackingLink: formData.trackingLink,
      platform: formData.platform,
      publicationDate: formData.publicationDate,
      status: formData.status as ContentEntry["status"],
      tags: selectedTags,
      contentType: formData.contentType,
      notes: formData.notes,
      reshares: reshares.length > 0 ? reshares : undefined,
    };

    const categoryFields =
      category === "Written" || category === "Video"
        ? { views: parseInt(formData.views) || 0 }
        : category === "Package"
        ? {
            packageName: formData.packageName || undefined,
            downloads: parseInt(formData.downloads) || 0,
            weeklyDownloads: parseInt(formData.weeklyDownloads) || 0,
          }
        : category === "Event"
        ? {
            eventName: formData.eventName || undefined,
            eventLocation: formData.eventLocation || undefined,
            attendees: parseInt(formData.attendees) || 0,
          }
        : category === "Podcast"
        ? {
            podcastName: formData.podcastName || undefined,
            downloads: parseInt(formData.downloads) || 0,
          }
        : category === "Demo"
        ? {
            repoUrl: formData.repoUrl || undefined,
            stack: formData.stack || undefined,
            stars: parseInt(formData.stars) || 0,
          }
        : {};

    const entryData = { ...base, ...categoryFields };

    try {
      if (isEditing && existingEntry?._id) {
        await updateContent({ id: existingEntry._id, ...entryData });
      } else {
        await createContent(entryData);
      }

      // The public portfolio is statically cached, so a newly published piece
      // would otherwise take up to 5 minutes to appear on /@handle — long enough
      // to send someone a link to a page that does not show the work yet. Fire
      // and forget: a failed refresh just means the page waits for its own
      // revalidation, which is not worth blocking the redirect over.
      if (entryData.status === "Published") {
        void fetch("/api/portfolio/revalidate", { method: "POST" }).catch(() => {});
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard/content");
      }
    } catch (error) {
      console.error("Error saving content:", error);
    }
  };

  const platforms = PLATFORMS_BY_CATEGORY[category];
  const subtypes = SUBTYPES_BY_CATEGORY[category];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Category selector ── */}
      <Card data-tour="form-category" className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Content Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const Icon = meta.icon;
              const isSelected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all hover:shadow-sm ${
                    isSelected
                      ? meta.selectorClass + " border-current shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{meta.label}</span>
                  <span className="text-xs opacity-70 leading-tight hidden sm:block">
                    {meta.description}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Core details ── */}
      <Card data-tour="form-details" className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">

          {/* Client */}
          <div className="space-y-2 md:col-span-2">
            <Label className="text-foreground">Client</Label>
            <Select
              value={formData.client || undefined}
              onValueChange={(v) => handleInputChange("client", v)}
              disabled={!clients || clients.length === 0}
            >
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue
                  placeholder={
                    clients === undefined
                      ? "Loading clients…"
                      : clients.length === 0
                        ? "No clients yet"
                        : "Select client"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? [])
                  .filter((c) => !!c.slug)
                  .map((c) => (
                    <SelectItem key={c._id} value={c.slug!}>
                      {c.company || c.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        /{c.slug}
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {clients && clients.length === 0 && (
              <p className="text-xs text-muted-foreground">
                <Link href="/dashboard/clients" className="underline hover:text-foreground">
                  Add a client
                </Link>{" "}
                first — entries are attributed to a client dashboard by its slug.
              </p>
            )}
            {clients && clients.length > 0 && clients.every((c) => !c.slug) && (
              <p className="text-xs text-muted-foreground">
                None of your clients have a dashboard slug yet.{" "}
                <Link href="/dashboard/clients" className="underline hover:text-foreground">
                  Add one
                </Link>{" "}
                to make their dashboard reachable.
              </p>
            )}
            {formData.client && (
              <Button
                type="button" variant="ghost" size="sm"
                onClick={() => handleInputChange("client", "")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear selection
              </Button>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title" className="text-foreground">
              {getTitleLabel(category)} *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder={
                category === "Event"   ? "e.g. Building Auth for AI Apps" :
                category === "Podcast" ? "e.g. DevRel in the AI era" :
                category === "Package" ? "e.g. Convex Rate Limiter" :
                category === "Demo"    ? "e.g. Next.js Auth Starter Kit" :
                "Enter title"
              }
              className="bg-input border-border text-foreground"
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* ── Category-specific extra fields ── */}

          {/* Package: npm package name */}
          {category === "Package" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="packageName" className="flex items-center gap-2 text-foreground">
                <Hash className="h-4 w-4" />
                npm Package Name
              </Label>
              <Input
                id="packageName"
                value={formData.packageName}
                onChange={(e) => handleInputChange("packageName", e.target.value)}
                placeholder="e.g. @convex-dev/rate-limiter"
                className="bg-input border-border text-foreground font-mono text-sm"
              />
            </div>
          )}

          {/* Event: event name + location */}
          {category === "Event" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="eventName" className="text-foreground">Event / Conference Name</Label>
                <Input
                  id="eventName"
                  value={formData.eventName}
                  onChange={(e) => handleInputChange("eventName", e.target.value)}
                  placeholder="e.g. React Summit 2026"
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventLocation" className="flex items-center gap-2 text-foreground">
                  <MapPin className="h-4 w-4" />
                  Location
                </Label>
                <Input
                  id="eventLocation"
                  value={formData.eventLocation}
                  onChange={(e) => handleInputChange("eventLocation", e.target.value)}
                  placeholder="e.g. Amsterdam, Netherlands"
                  className="bg-input border-border text-foreground"
                />
              </div>
              {/* Event platform = free text */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="platform" className="text-foreground">Platform / Conference</Label>
                <Input
                  id="platform"
                  value={formData.platform}
                  onChange={(e) => handleInputChange("platform", e.target.value)}
                  placeholder="e.g. React Summit, Local Meetup, JSConf"
                  className="bg-input border-border text-foreground"
                />
              </div>
            </>
          )}

          {/* Podcast: show name */}
          {category === "Podcast" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="podcastName" className="flex items-center gap-2 text-foreground">
                <Mic className="h-4 w-4" />
                Podcast Show Name
              </Label>
              <Input
                id="podcastName"
                value={formData.podcastName}
                onChange={(e) => handleInputChange("podcastName", e.target.value)}
                placeholder="e.g. The Changelog, Syntax FM"
                className="bg-input border-border text-foreground"
              />
            </div>
          )}

          {/* Demo: repo link + tech stack */}
          {category === "Demo" && (
            <>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="repoUrl" className="flex items-center gap-2 text-foreground">
                  <Github className="h-4 w-4" />
                  GitHub Repo Link *
                </Label>
                <Input
                  id="repoUrl"
                  type="url"
                  value={formData.repoUrl}
                  onChange={(e) => handleInputChange("repoUrl", e.target.value)}
                  placeholder="https://github.com/org/repo"
                  className="bg-input border-border text-foreground font-mono text-sm"
                />
                {errors.repoUrl && <p className="text-xs text-destructive">{errors.repoUrl}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="stack" className="flex items-center gap-2 text-foreground">
                  <Layers className="h-4 w-4" />
                  Tech Stack
                </Label>
                <Input
                  id="stack"
                  value={formData.stack}
                  onChange={(e) => handleInputChange("stack", e.target.value)}
                  placeholder="e.g. Next.js, Convex, Tailwind"
                  className="bg-input border-border text-foreground"
                />
              </div>
            </>
          )}

          {/* Platform dropdown (Written / Video / Podcast / Package / Demo) */}
          {category !== "Event" && (
            <div className="space-y-2">
              <Label className="text-foreground">
                {category === "Demo" ? "Platform (optional)" : "Platform *"}
              </Label>
              <Select
                value={formData.platform}
                onValueChange={(v) => handleInputChange("platform", v)}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.platform && <p className="text-xs text-destructive">{errors.platform}</p>}
            </div>
          )}

          {/* Sub-type */}
          <div className="space-y-2">
            <Label className="text-foreground">Sub-type *</Label>
            <Select
              value={formData.contentType}
              onValueChange={(v) => handleInputChange("contentType", v)}
            >
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue placeholder="Select sub-type" />
              </SelectTrigger>
              <SelectContent>
                {subtypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.contentType && <p className="text-xs text-destructive">{errors.contentType}</p>}
          </div>

          {/* Publication date */}
          <div className="space-y-2">
            <Label htmlFor="publicationDate" className="text-foreground">
              {category === "Event" ? "Event Date" : "Publication Date"} *
            </Label>
            <Input
              id="publicationDate"
              type="date"
              value={formData.publicationDate}
              onChange={(e) => handleInputChange("publicationDate", e.target.value)}
              className="bg-input border-border text-foreground"
            />
            {errors.publicationDate && (
              <p className="text-xs text-destructive">{errors.publicationDate}</p>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-foreground">Status *</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => handleInputChange("status", v)}
            >
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.status && <p className="text-xs text-destructive">{errors.status}</p>}
          </div>

          {/* Post / video link */}
          {(category === "Written" || category === "Video" || category === "Podcast") && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="link" className="flex items-center gap-2 text-foreground">
                <ExternalLink className="h-4 w-4" />
                {category === "Podcast" ? "Episode Link" : "Post Link"}
              </Label>
              <Input
                id="link"
                type="url"
                value={formData.link}
                onChange={(e) => handleInputChange("link", e.target.value)}
                placeholder="https://..."
                className="bg-input border-border text-foreground"
              />
            </div>
          )}

          {/* Package / Event / Demo link (optional recording, npm page or deployment) */}
          {(category === "Package" || category === "Event" || category === "Demo") && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="link" className="flex items-center gap-2 text-foreground">
                <ExternalLink className="h-4 w-4" />
                {category === "Package"
                  ? "npm / Package Link"
                  : category === "Demo"
                  ? "Live / Deploy Link (optional)"
                  : "Recording or Event Page (optional)"}
              </Label>
              <Input
                id="link"
                type="url"
                value={formData.link}
                onChange={(e) => handleInputChange("link", e.target.value)}
                placeholder="https://..."
                className="bg-input border-border text-foreground"
              />
            </div>
          )}

          {/* Tracking link — Written + Video only */}
          {(category === "Written" || category === "Video") && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="trackingLink" className="flex items-center gap-2 text-foreground">
                <Link2 className="h-4 w-4 text-primary" />
                Tracking Link (UTM)
              </Label>
              <Input
                id="trackingLink"
                type="url"
                value={formData.trackingLink}
                onChange={(e) => handleInputChange("trackingLink", e.target.value)}
                placeholder="https://kinde.com?utm_source=..."
                className="bg-input border-border text-foreground font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Include UTM parameters for tracking attribution
              </p>
            </div>
          )}

          {/* ── Metric fields per category ── */}

          {/* Written / Video: Views */}
          {(category === "Written" || category === "Video") && (
            <div className="space-y-2">
              <Label htmlFor="views" className="flex items-center gap-2 text-foreground">
                <Eye className="h-4 w-4" />
                Views
              </Label>
              <Input
                id="views"
                type="number"
                min="0"
                value={formData.views}
                onChange={(e) => handleInputChange("views", e.target.value)}
                placeholder="0"
                className="bg-input border-border text-foreground"
              />
            </div>
          )}

          {/* Event: Attendees */}
          {category === "Event" && (
            <div className="space-y-2">
              <Label htmlFor="attendees" className="flex items-center gap-2 text-foreground">
                <Users className="h-4 w-4" />
                Attendees
              </Label>
              <Input
                id="attendees"
                type="number"
                min="0"
                value={formData.attendees}
                onChange={(e) => handleInputChange("attendees", e.target.value)}
                placeholder="0"
                className="bg-input border-border text-foreground"
              />
            </div>
          )}

          {/* Podcast: Listeners */}
          {category === "Podcast" && (
            <div className="space-y-2">
              <Label htmlFor="downloads" className="flex items-center gap-2 text-foreground">
                <Headphones className="h-4 w-4" />
                Listeners / Downloads
              </Label>
              <Input
                id="downloads"
                type="number"
                min="0"
                value={formData.downloads}
                onChange={(e) => handleInputChange("downloads", e.target.value)}
                placeholder="0"
                className="bg-input border-border text-foreground"
              />
            </div>
          )}

          {/* Demo: GitHub stars */}
          {category === "Demo" && (
            <div className="space-y-2">
              <Label htmlFor="stars" className="flex items-center gap-2 text-foreground">
                <Star className="h-4 w-4" />
                GitHub Stars
              </Label>
              <Input
                id="stars"
                type="number"
                min="0"
                value={formData.stars}
                onChange={(e) => handleInputChange("stars", e.target.value)}
                placeholder="0"
                className="bg-input border-border text-foreground"
              />
            </div>
          )}

          {/* Package: weekly + total downloads */}
          {category === "Package" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="weeklyDownloads" className="flex items-center gap-2 text-foreground">
                  <Download className="h-4 w-4" />
                  Weekly Downloads
                </Label>
                <Input
                  id="weeklyDownloads"
                  type="number"
                  min="0"
                  value={formData.weeklyDownloads}
                  onChange={(e) => handleInputChange("weeklyDownloads", e.target.value)}
                  placeholder="0"
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="downloads" className="flex items-center gap-2 text-foreground">
                  <Download className="h-4 w-4" />
                  Total Downloads
                </Label>
                <Input
                  id="downloads"
                  type="number"
                  min="0"
                  value={formData.downloads}
                  onChange={(e) => handleInputChange("downloads", e.target.value)}
                  placeholder="0"
                  className="bg-input border-border text-foreground"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Reshares (all categories) ── */}
      <Card data-tour="form-reshares" className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Reshares & Cross-Posts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {reshares.length > 0 && (
            <div className="space-y-2">
              {reshares.map((reshare, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                    <span className="font-medium text-foreground">{reshare.platform}</span>
                    <div className="col-span-2 flex items-center gap-2">
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      <a
                        href={reshare.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {reshare.link}
                      </a>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{reshare.date}</span>
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => removeReshare(index)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 p-4 border border-border rounded-lg">
            <Label className="text-sm font-medium text-foreground">Add Reshare</Label>
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                value={newReshare.platform}
                onValueChange={(v) => setNewReshare((prev) => ({ ...prev, platform: v }))}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  {RESHARE_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="url"
                value={newReshare.link}
                onChange={(e) => setNewReshare((prev) => ({ ...prev, link: e.target.value }))}
                placeholder="Reshare link"
                className="bg-input border-border text-foreground"
              />
              <Input
                type="date"
                value={newReshare.date}
                onChange={(e) => setNewReshare((prev) => ({ ...prev, date: e.target.value }))}
                className="bg-input border-border text-foreground"
              />
            </div>
            <Button
              type="button" variant="secondary" size="sm"
              onClick={addReshare}
              disabled={!newReshare.platform || !newReshare.link}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Reshare
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Tags ── */}
      <Card data-tour="form-tags" className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  title="remove"
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {DEFAULT_TAGS.filter((t) => !selectedTags.includes(t)).map((tag) => (
              <Badge
                key={tag} variant="outline"
                className="cursor-pointer hover:bg-secondary"
                onClick={() => addTag(tag)}
              >
                + {tag}
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Add custom tag"
              className="bg-input border-border text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addTag(customTag); }
              }}
            />
            <Button type="button" variant="secondary" onClick={() => addTag(customTag)}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Notes ── */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.notes}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            placeholder="Add any internal notes..."
            className="min-h-20 bg-input border-border text-foreground"
          />
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      <div data-tour="form-actions" className="flex justify-end gap-3">
        <Button
          type="button" variant="outline"
          onClick={() => router.back()}
          className="bg-transparent"
        >
          Cancel
        </Button>
        <Button type="submit">
          {isEditing ? "Update Entry" : "Add Entry"}
        </Button>
      </div>
    </form>
  );
}

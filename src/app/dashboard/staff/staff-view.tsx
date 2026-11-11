"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMinuteTo24Hour, timeStringToMinute } from "@/lib/date-utils";
import {
  createStaffMemberAction,
  updateStaffMemberAction,
  toggleStaffActiveAction,
  updateStaffScheduleAction,
  updateStaffServicesAction,
  type ScheduleBlock,
  type StaffActionResult,
} from "@/app/actions/staff";

// ─── Types ──────────────────────────────────────────────────────────────────

export type StaffWithDetails = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  active: boolean;
  schedules: { id: string; dayOfWeek: number; startMinute: number; endMinute: number }[];
  serviceIds: string[];
};

export type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
};

type Props = {
  staffList: StaffWithDetails[];
  services: ServiceOption[];
  plan: "STARTER" | "GROWTH";
  planLimit: number | null;
  allowSplitShifts: boolean;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// ─── Schedule Editor ─────────────────────────────────────────────────────────

type DayBlocks = { startStr: string; endStr: string }[];
type WeekSchedule = { [dayOfWeek: number]: DayBlocks };

function buildInitialWeekSchedule(
  schedules: StaffWithDetails["schedules"]
): WeekSchedule {
  const week: WeekSchedule = {};
  for (const s of schedules) {
    if (!week[s.dayOfWeek]) week[s.dayOfWeek] = [];
    week[s.dayOfWeek].push({
      startStr: formatMinuteTo24Hour(s.startMinute),
      endStr: formatMinuteTo24Hour(s.endMinute),
    });
  }
  return week;
}

function weekScheduleToBlocks(week: WeekSchedule): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];
  for (const [day, dayBlocks] of Object.entries(week)) {
    for (const b of dayBlocks) {
      blocks.push({
        dayOfWeek: parseInt(day, 10),
        startMinute: timeStringToMinute(b.startStr),
        endMinute: timeStringToMinute(b.endStr),
      });
    }
  }
  return blocks;
}

type ScheduleEditorProps = {
  staffId: string;
  initialSchedules: StaffWithDetails["schedules"];
  allowSplitShifts: boolean;
  onSaved: (msg: string) => void;
};

function ScheduleEditor({
  staffId,
  initialSchedules,
  allowSplitShifts,
  onSaved,
}: ScheduleEditorProps) {
  const [week, setWeek] = useState<WeekSchedule>(
    buildInitialWeekSchedule(initialSchedules)
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function toggleDay(day: number) {
    setWeek((prev) => {
      const next = { ...prev };
      if (next[day]) {
        delete next[day];
      } else {
        next[day] = [{ startStr: "09:00", endStr: "17:00" }];
      }
      return next;
    });
  }

  function addBlock(day: number) {
    setWeek((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), { startStr: "09:00", endStr: "17:00" }],
    }));
  }

  function removeBlock(day: number, idx: number) {
    setWeek((prev) => {
      const updated = [...(prev[day] || [])];
      updated.splice(idx, 1);
      const next = { ...prev };
      if (updated.length === 0) {
        delete next[day];
      } else {
        next[day] = updated;
      }
      return next;
    });
  }

  function updateBlock(
    day: number,
    idx: number,
    field: "startStr" | "endStr",
    value: string
  ) {
    setWeek((prev) => {
      const updated = [...(prev[day] || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, [day]: updated };
    });
  }

  function handleSave() {
    setError("");
    const blocks = weekScheduleToBlocks(week);
    startTransition(async () => {
      const result = await updateStaffScheduleAction(staffId, blocks);
      if (result.error) {
        setError(result.error);
      } else {
        onSaved("Schedule saved.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {DAY_FULL.map((dayLabel, dayIndex) => {
        const dayBlocks = week[dayIndex];
        const isWorking = !!dayBlocks && dayBlocks.length > 0;
        return (
          <div key={dayIndex} className="rounded-lg border border-line bg-card p-3">
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={isWorking}
                  onChange={() => toggleDay(dayIndex)}
                  className="accent-accent h-4 w-4"
                />
                <span className="text-sm font-medium text-white">{dayLabel}</span>
              </label>
              {isWorking && (
                allowSplitShifts ? (
                  <button
                    type="button"
                    onClick={() => addBlock(dayIndex)}
                    className="text-xs text-muted hover:text-accent transition"
                  >
                    + Split shift
                  </button>
                ) : (
                  <a
                    href="/dashboard/billing"
                    title="Split shifts require Growth plan"
                    className="text-[11px] text-amber-400/80 hover:text-amber-300 transition flex items-center gap-1"
                  >
                    <span>⚡ Split shifts</span>
                    <span className="text-[10px] uppercase font-semibold tracking-wider bg-amber-400/20 px-1 rounded">Growth</span>
                  </a>
                )
              )}
            </div>

            {isWorking && dayBlocks.map((block, idx) => (
              <div key={idx} className="mt-2 flex items-center gap-2 pl-7">
                <input
                  type="time"
                  value={block.startStr}
                  onChange={(e) => updateBlock(dayIndex, idx, "startStr", e.target.value)}
                  className="rounded border border-line bg-surface px-2 py-1 text-sm text-white"
                />
                <span className="text-xs text-muted">to</span>
                <input
                  type="time"
                  value={block.endStr}
                  onChange={(e) => updateBlock(dayIndex, idx, "endStr", e.target.value)}
                  className="rounded border border-line bg-surface px-2 py-1 text-sm text-white"
                />
                {dayBlocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBlock(dayIndex, idx)}
                    className="text-xs text-red-400 hover:text-red-300 transition"
                    aria-label="Remove block"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {!isWorking && (
              <p className="mt-1 pl-7 text-xs text-muted">Not working</p>
            )}
          </div>
        );
      })}

      {error && (
        <p className="rounded bg-red-900/30 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-black hover:bg-accent/90 transition disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save Schedule"}
      </button>
    </div>
  );
}

// ─── Service Assignment Panel ─────────────────────────────────────────────────

type ServiceAssignmentProps = {
  staffId: string;
  allServices: ServiceOption[];
  assignedIds: string[];
  onSaved: (msg: string) => void;
};

function ServiceAssignment({
  staffId,
  allServices,
  assignedIds,
  onSaved,
}: ServiceAssignmentProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    setError("");
    startTransition(async () => {
      const result = await updateStaffServicesAction(staffId, Array.from(selected));
      if (result.error) {
        setError(result.error);
      } else {
        onSaved("Services saved.");
      }
    });
  }

  if (allServices.length === 0) {
    return (
      <p className="text-sm text-muted">
        No services found. Add services first.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {allServices.map((svc) => (
        <label
          key={svc.id}
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-card p-3 hover:border-accent/40 transition"
        >
          <input
            type="checkbox"
            checked={selected.has(svc.id)}
            onChange={() => toggle(svc.id)}
            className="accent-accent h-4 w-4"
          />
          <div className="flex flex-1 items-center justify-between">
            <span className="text-sm text-white">{svc.name}</span>
            <span className="text-xs text-muted">
              {svc.durationMinutes} min · {formatCents(svc.priceCents)}
            </span>
          </div>
        </label>
      ))}

      {error && (
        <p className="rounded bg-red-900/30 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-black hover:bg-accent/90 transition disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save Services"}
      </button>
    </div>
  );
}

// ─── Staff Card ───────────────────────────────────────────────────────────────

type StaffCardProps = {
  member: StaffWithDetails;
  isSelected: boolean;
  onSelect: () => void;
};

function StaffCard({ member, isSelected, onSelect }: StaffCardProps) {
  const workDays = Array.from(new Set(member.schedules.map((s) => s.dayOfWeek))).sort();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-4 transition ${
        isSelected
          ? "border-accent bg-accent/10"
          : "border-line bg-card hover:border-accent/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-white">{member.name}</p>
          {member.title && (
            <p className="mt-0.5 text-xs text-muted">{member.title}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            member.active
              ? "bg-green-900/40 text-green-400"
              : "bg-zinc-800 text-muted"
          }`}
        >
          {member.active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {DAYS.map((label, i) => (
          <span
            key={i}
            className={`rounded px-1.5 py-0.5 text-xs ${
              workDays.includes(i)
                ? "bg-accent/20 text-accent"
                : "bg-zinc-800/60 text-muted"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <p className="mt-2 text-xs text-muted">
        {member.serviceIds.length} service
        {member.serviceIds.length !== 1 ? "s" : ""} assigned
      </p>
    </button>
  );
}

// ─── Add Staff Form ───────────────────────────────────────────────────────────

type AddStaffFormProps = {
  plan: "STARTER" | "GROWTH";
  planLimit: number | null;
  activeStaffCount: number;
  onAdded: (member: { id: string; name: string; title: string | null; email: string | null }) => void;
};

function AddStaffForm({ plan, planLimit, activeStaffCount, onAdded }: AddStaffFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const atLimit = planLimit !== null && activeStaffCount >= planLimit;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setUpgradeRequired(false);

    startTransition(async () => {
      const result: StaffActionResult = await createStaffMemberAction({
        name,
        title: title || undefined,
        email: email || undefined,
      });
      if (result.error) {
        setError(result.error);
        setUpgradeRequired(result.upgradeRequired ?? false);
      } else {
        onAdded({
          id: `new-${Date.now()}`,
          name: name.trim(),
          title: title.trim() || null,
          email: email.trim() || null,
        });
        setName("");
        setTitle("");
        setEmail("");
      }
    });
  }

  async function handleLaunchGrowthUpgrade() {
    try {
      setIsUpgrading(true);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "GROWTH" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        router.push("/dashboard/billing");
      }
    } catch {
      router.push("/dashboard/billing");
    } finally {
      setIsUpgrading(false);
    }
  }

  if (atLimit && plan === "STARTER") {
    return (
      <div className="rounded-xl border border-amber-800/40 bg-amber-900/10 p-4 text-sm">
        <p className="font-medium text-amber-400">Starter plan limit reached</p>
        <p className="mt-1 text-muted">
          You have {activeStaffCount}/{planLimit} active stylists. Upgrade to Growth for
          unlimited staff and advanced split shifts.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleLaunchGrowthUpgrade}
            disabled={isUpgrading}
            className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-black hover:bg-accent/90 transition disabled:opacity-50"
          >
            {isUpgrading ? "Launching Checkout…" : "Upgrade to Growth ($79/mo) →"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-muted mb-1">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Isabelle Moreau"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Title / Role</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Senior Colorist"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Email (optional)</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="stylist@example.com"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {error && (
        <div className="rounded bg-red-900/30 px-3 py-2 text-sm text-red-400">
          {error}
          {upgradeRequired && (
            <button
              type="button"
              onClick={handleLaunchGrowthUpgrade}
              disabled={isUpgrading}
              className="ml-2 font-semibold underline underline-offset-2 hover:text-red-300 disabled:opacity-50"
            >
              {isUpgrading ? "Launching…" : "Upgrade to Growth ($79/mo) →"}
            </button>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className="w-full rounded-full bg-accent py-2 text-sm font-medium text-black hover:bg-accent/90 transition disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add Stylist"}
      </button>
    </form>
  );
}

// ─── Edit Staff Panel ─────────────────────────────────────────────────────────

type EditTab = "info" | "schedule" | "services";

type EditPanelProps = {
  member: StaffWithDetails;
  services: ServiceOption[];
  allowSplitShifts: boolean;
  onClose: () => void;
  onUpdated: (patch: Partial<StaffWithDetails>) => void;
};

function EditPanel({
  member,
  services,
  allowSplitShifts,
  onClose,
  onUpdated,
}: EditPanelProps) {
  const [tab, setTab] = useState<EditTab>("info");
  const [name, setName] = useState(member.name);
  const [title, setTitle] = useState(member.title ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [active, setActive] = useState(member.active);
  const [isPending, startTransition] = useTransition();
  const [infoError, setInfoError] = useState("");
  const [infoSuccess, setInfoSuccess] = useState("");
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function handleInfoSave(e: React.FormEvent) {
    e.preventDefault();
    setInfoError("");
    setInfoSuccess("");
    startTransition(async () => {
      const result = await updateStaffMemberAction(member.id, {
        name,
        title,
        email,
        active,
      });
      if (result.error) {
        setInfoError(result.error);
      } else {
        setInfoSuccess("Saved.");
        onUpdated({ name, title: title || null, email: email || null, active });
        setTimeout(() => setInfoSuccess(""), 2500);
      }
    });
  }

  function handleToggleActive() {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      const result = await toggleStaffActiveAction(member.id, next);
      if (result.error) {
        setActive(!next); // revert
        setInfoError(result.error);
      } else {
        onUpdated({ active: next });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">{member.name}</h2>
          {member.title && <p className="text-sm text-muted">{member.title}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-white transition text-lg leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-lg bg-surface p-1">
        {(["info", "schedule", "services"] as EditTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition ${
              tab === t ? "bg-card text-white shadow" : "text-muted hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-4 rounded bg-green-900/30 px-3 py-2 text-sm text-green-400">
          {toast}
        </div>
      )}

      {/* Info Tab */}
      {tab === "info" && (
        <form onSubmit={handleInfoSave} className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Title / Role</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Colorist"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="stylist@example.com"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
            <div>
              <p className="text-sm text-white">Active status</p>
              <p className="text-xs text-muted">
                {active ? "Visible for bookings" : "Hidden from booking page"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={isPending}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                active ? "bg-accent" : "bg-zinc-700"
              }`}
              role="switch"
              aria-checked={active}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  active ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {infoError && (
            <p className="rounded bg-red-900/30 px-3 py-2 text-sm text-red-400">
              {infoError}
            </p>
          )}
          {infoSuccess && (
            <p className="rounded bg-green-900/30 px-3 py-2 text-sm text-green-400">
              {infoSuccess}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-full bg-accent py-2 text-sm font-medium text-black hover:bg-accent/90 transition disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save Info"}
          </button>
        </form>
      )}

      {/* Schedule Tab */}
      {tab === "schedule" && (
        <ScheduleEditor
          staffId={member.id}
          initialSchedules={member.schedules}
          allowSplitShifts={allowSplitShifts}
          onSaved={showToast}
        />
      )}

      {/* Services Tab */}
      {tab === "services" && (
        <ServiceAssignment
          staffId={member.id}
          allServices={services}
          assignedIds={member.serviceIds}
          onSaved={showToast}
        />
      )}
    </div>
  );
}

// ─── Main StaffView ───────────────────────────────────────────────────────────

export function StaffView({
  staffList: initialStaff,
  services,
  plan,
  planLimit,
  allowSplitShifts,
}: Props) {
  const [staff, setStaff] = useState<StaffWithDetails[]>(initialStaff);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialStaff.length > 0 ? initialStaff[0].id : null
  );
  const [showAddForm, setShowAddForm] = useState(false);

  const activeCount = staff.filter((s) => s.active).length;

  function handleAdded(partial: { id: string; name: string; title: string | null; email: string | null }) {
    // Optimistically add placeholder; next navigation will refresh from DB
    const newMember: StaffWithDetails = {
      ...partial,
      active: true,
      schedules: [],
      serviceIds: [],
    };
    setStaff((prev) => [...prev, newMember]);
    setSelectedId(newMember.id);
    setShowAddForm(false);
  }

  function handleUpdated(id: string, patch: Partial<StaffWithDetails>) {
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  const selectedMember = staff.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {/* ── Left column: list + add ───────────────────────────────────── */}
      <div className="space-y-4">
        {/* Plan badge */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            <span className="text-white font-medium">{activeCount}</span>
            {planLimit !== null ? `/${planLimit}` : ""} active stylist
            {activeCount !== 1 ? "s" : ""}
          </p>
          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
            {plan === "STARTER" ? "Starter" : "Growth"}
          </span>
        </div>

        {/* Staff cards */}
        <div className="space-y-2">
          {staff.map((member) => (
            <StaffCard
              key={member.id}
              member={member}
              isSelected={selectedId === member.id}
              onSelect={() => {
                setSelectedId(member.id);
                setShowAddForm(false);
              }}
            />
          ))}

          {staff.length === 0 && !showAddForm && (
            <div className="rounded-xl border border-line border-dashed p-6 text-center">
              <p className="text-sm text-muted">No stylists yet.</p>
              <p className="mt-1 text-xs text-muted">Add your first stylist below.</p>
            </div>
          )}
        </div>

        {/* Add stylist button / form */}
        {showAddForm ? (
          <div className="rounded-xl border border-line bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">New Stylist</h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-xs text-muted hover:text-white transition"
              >
                Cancel
              </button>
            </div>
            <AddStaffForm
              plan={plan}
              planLimit={planLimit}
              activeStaffCount={activeCount}
              onAdded={handleAdded}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full rounded-xl border border-dashed border-line py-3 text-sm text-muted hover:border-accent hover:text-accent transition"
          >
            + Add Stylist
          </button>
        )}
      </div>

      {/* ── Right column: edit panel ──────────────────────────────────── */}
      <div>
        {selectedMember ? (
          <EditPanel
            key={selectedMember.id}
            member={selectedMember}
            services={services}
            allowSplitShifts={allowSplitShifts}
            onClose={() => setSelectedId(null)}
            onUpdated={(patch) => handleUpdated(selectedMember.id, patch)}
          />
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-line">
            <p className="text-sm text-muted">Select a stylist to edit</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { formatMinuteTo24Hour, timeStringToMinute } from "@/lib/date-utils";
import {
  updateSalonProfileAction,
  updateSalonHoursAction,
  type SalonHourInput,
} from "@/app/actions/settings";

export type SalonProfileData = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  timezone: string;
};

export type SalonHourData = {
  dayOfWeek: number;
  closed: boolean;
  startMinute: number;
  endMinute: number;
};

type Props = {
  salon: SalonProfileData;
  hours: SalonHourData[];
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET) - New York" },
  { value: "America/Chicago", label: "Central Time (CT) - Chicago" },
  { value: "America/Denver", label: "Mountain Time (MT) - Denver" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT) - Los Angeles" },
  { value: "America/Anchorage", label: "Alaska Time (AKT) - Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT) - Honolulu" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT) - London" },
  { value: "Europe/Paris", label: "Central European Time (CET) - Paris" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST) - Tokyo" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET) - Sydney" },
];

export function SettingsView({ salon, hours: initialHours }: Props) {
  // Profile state
  const [name, setName] = useState(salon.name);
  const [slug, setSlug] = useState(salon.slug);
  const [phone, setPhone] = useState(salon.phone ?? "");
  const [email, setEmail] = useState(salon.email ?? "");
  const [addressLine, setAddressLine] = useState(salon.addressLine ?? "");
  const [city, setCity] = useState(salon.city ?? "");
  const [timezone, setTimezone] = useState(salon.timezone);

  // Hours state (maps 0..6 to closed, startStr, endStr)
  const [hoursState, setHoursState] = useState<
    Record<number, { closed: boolean; startStr: string; endStr: string }>
  >(() => {
    const map: Record<number, { closed: boolean; startStr: string; endStr: string }> = {};
    for (let d = 0; d < 7; d++) {
      const match = initialHours.find((h) => h.dayOfWeek === d);
      if (match) {
        map[d] = {
          closed: match.closed,
          startStr: formatMinuteTo24Hour(match.startMinute),
          endStr: formatMinuteTo24Hour(match.endMinute),
        };
      } else {
        // Default standard business hours: closed on Sunday, 09:00 - 18:00 others
        map[d] = {
          closed: d === 0,
          startStr: "09:00",
          endStr: "18:00",
        };
      }
    }
    return map;
  });

  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [hoursMsg, setHoursMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPendingProfile, startProfileTransition] = useTransition();
  const [isPendingHours, startHoursTransition] = useTransition();

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);

    startProfileTransition(async () => {
      const res = await updateSalonProfileAction({
        name,
        slug,
        phone: phone || undefined,
        email: email || undefined,
        addressLine: addressLine || undefined,
        city: city || undefined,
        timezone,
      });

      if (res.error) {
        setProfileMsg({ type: "error", text: res.error });
      } else {
        setProfileMsg({ type: "success", text: "Salon information saved successfully." });
        setTimeout(() => setProfileMsg(null), 4000);
      }
    });
  }

  function handleHoursSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHoursMsg(null);

    const payload: SalonHourInput[] = [];
    for (let d = 0; d < 7; d++) {
      const entry = hoursState[d];
      payload.push({
        dayOfWeek: d,
        closed: entry.closed,
        startMinute: timeStringToMinute(entry.startStr),
        endMinute: timeStringToMinute(entry.endStr),
      });
    }

    startHoursTransition(async () => {
      const res = await updateSalonHoursAction(payload);
      if (res.error) {
        setHoursMsg({ type: "error", text: res.error });
      } else {
        setHoursMsg({ type: "success", text: "Weekly operating hours updated." });
        setTimeout(() => setHoursMsg(null), 4000);
      }
    });
  }

  function updateDayHour(
    day: number,
    field: "closed" | "startStr" | "endStr",
    value: boolean | string
  ) {
    setHoursState((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  }

  return (
    <div className="space-y-10">
      {/* ── Section 1: Salon Details & Booking URL ── */}
      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div className="border-b border-line pb-4 mb-6">
          <h2 className="font-display text-xl text-white">Salon Details</h2>
          <p className="mt-1 text-xs text-muted">
            Configure your brand identity, public booking URL, contact channels, and local timezone.
          </p>
        </div>

        {profileMsg && (
          <div
            className={`mb-6 rounded-xl border p-3 text-xs ${
              profileMsg.type === "error"
                ? "border-red-800/50 bg-red-900/30 text-red-400"
                : "border-green-800/50 bg-green-900/30 text-green-400"
            }`}
          >
            {profileMsg.text}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Salon Name */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                Salon Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Atelier Hair Co."
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {/* Public Slug */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                Public Booking Link <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white focus-within:border-accent">
                <span className="text-muted select-none">/book/</span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="atelier-hair"
                  className="w-full bg-transparent text-white placeholder:text-muted focus:outline-none ml-0.5"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Clients book appointments at this URL. Letters, numbers, and hyphens only.
              </p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                Public Contact Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@salon.com"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                Public Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(212) 555-0199"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                Street Address
              </label>
              <input
                type="text"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="452 Broadway, Floor 3"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                City / Region
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="New York, NY"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {/* Timezone */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                Salon Operating Timezone <span className="text-red-400">*</span>
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value} className="bg-surface text-white">
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted">
                All daily booking slots and stylist shifts are calculated relative to this local timezone.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-line">
            <button
              type="submit"
              disabled={isPendingProfile}
              className="rounded-full bg-accent px-6 py-2 text-xs font-semibold text-black hover:bg-accent/90 transition disabled:opacity-50"
            >
              {isPendingProfile ? "Saving Profile…" : "Save Salon Info"}
            </button>
          </div>
        </form>
      </section>

      {/* ── Section 2: Salon Operating Hours ── */}
      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div className="border-b border-line pb-4 mb-6">
          <h2 className="font-display text-xl text-white">Opening &amp; Operating Hours</h2>
          <p className="mt-1 text-xs text-muted">
            Define your salon’s overall open hours. Booking availability is restricted to these hours even if stylists have open shifts.
          </p>
        </div>

        {hoursMsg && (
          <div
            className={`mb-6 rounded-xl border p-3 text-xs ${
              hoursMsg.type === "error"
                ? "border-red-800/50 bg-red-900/30 text-red-400"
                : "border-green-800/50 bg-green-900/30 text-green-400"
            }`}
          >
            {hoursMsg.text}
          </div>
        )}

        <form onSubmit={handleHoursSubmit} className="space-y-3">
          {DAYS.map((dayName, dayIndex) => {
            const entry = hoursState[dayIndex];

            return (
              <div
                key={dayIndex}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition ${
                  entry.closed
                    ? "border-line/40 bg-surface/30 opacity-60"
                    : "border-line bg-surface hover:border-accent/40"
                }`}
              >
                {/* Day label and Closed toggle */}
                <div className="w-36 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`day-${dayIndex}`}
                    checked={!entry.closed}
                    onChange={(e) =>
                      updateDayHour(dayIndex, "closed", !e.target.checked)
                    }
                    className="accent-accent h-4 w-4"
                  />
                  <label
                    htmlFor={`day-${dayIndex}`}
                    className="cursor-pointer text-sm font-medium text-white select-none"
                  >
                    {dayName}
                  </label>
                </div>

                {/* Time selection or Closed pill */}
                <div className="flex items-center gap-3">
                  {entry.closed ? (
                    <span className="text-xs font-medium text-muted uppercase tracking-wider px-3 py-1 rounded bg-zinc-800/70 border border-zinc-700">
                      Closed
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={entry.startStr}
                        onChange={(e) =>
                          updateDayHour(dayIndex, "startStr", e.target.value)
                        }
                        className="rounded border border-line bg-card px-2.5 py-1 text-xs text-white focus:border-accent focus:outline-none"
                      />
                      <span className="text-xs text-muted">to</span>
                      <input
                        type="time"
                        value={entry.endStr}
                        onChange={(e) =>
                          updateDayHour(dayIndex, "endStr", e.target.value)
                        }
                        className="rounded border border-line bg-card px-2.5 py-1 text-xs text-white focus:border-accent focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex justify-end pt-4 border-t border-line">
            <button
              type="submit"
              disabled={isPendingHours}
              className="rounded-full bg-accent px-6 py-2 text-xs font-semibold text-black hover:bg-accent/90 transition disabled:opacity-50"
            >
              {isPendingHours ? "Saving Hours…" : "Save Operating Hours"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

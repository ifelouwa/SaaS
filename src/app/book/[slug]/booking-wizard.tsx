"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  createAppointmentAction,
  AppointmentConfirmation,
} from "@/app/actions/booking";
import { AvailableSlot, AvailabilityResponse } from "@/lib/availability";

type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
};

type StaffItem = {
  id: string;
  name: string;
  title: string | null;
  serviceIds: string[];
};

type SalonDetails = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  timezone: string;
};

type Props = {
  salon: SalonDetails;
  services: ServiceItem[];
  staff: StaffItem[];
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getTodayString() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

function getUpcomingDays(count = 7) {
  const days = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayName = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" });
    const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    days.push({ dateStr, dayName, monthDay });
  }

  return days;
}

export function BookingWizard({ salon, services, staff }: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Selections
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("any");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // Availability state
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Form details
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  // Submission state
  const [isSubmitting, startSubmitting] = useTransition();
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedAppt, setConfirmedAppt] = useState<AppointmentConfirmation | null>(null);

  const upcomingDays = getUpcomingDays(7);

  // Filter stylists capable of performing the selected service
  const eligibleStaff = selectedService
    ? staff.filter((s) => s.serviceIds.includes(selectedService.id))
    : staff;

  // Fetch slots whenever selectedDate, selectedService, or selectedStaffId change
  useEffect(() => {
    if (!selectedService || currentStep !== 3) return;

    let isMounted = true;
    const controller = new AbortController();

    const params = new URLSearchParams({
      date: selectedDate,
      serviceId: selectedService.id,
    });
    if (selectedStaffId && selectedStaffId !== "any") {
      params.set("staffId", selectedStaffId);
    }

    async function loadSlots() {
      try {
        const res = await fetch(`/api/salons/${salon.slug}/availability?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to load slots");
        }
        const data: AvailabilityResponse = await res.json();
        if (isMounted) {
          setAvailability(data);
          setIsLoadingSlots(false);
        }
      } catch (err: unknown) {
        if (isMounted && (err as Error).name !== "AbortError") {
          setAvailabilityError((err as Error).message || "Failed to load availability");
          setIsLoadingSlots(false);
        }
      }
    }

    // Trigger loading state before network request
    const timer = setTimeout(() => {
      if (isMounted) {
        setIsLoadingSlots(true);
        setAvailabilityError(null);
      }
    }, 0);

    loadSlots();

    return () => {
      isMounted = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [salon.slug, selectedService, selectedStaffId, selectedDate, currentStep]);

  const handleSelectService = (service: ServiceItem) => {
    setSelectedService(service);
    setSelectedStaffId("any");
    setSelectedSlot(null);
    setCurrentStep(2);
  };

  const handleSelectStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    setSelectedSlot(null);
    setCurrentStep(3);
  };

  const handleSelectSlot = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setCurrentStep(4);
  };

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;

    // Pick specific stylist if "any" was selected
    const assignedStaffId =
      selectedStaffId === "any"
        ? selectedSlot.availableStaff[0]?.id
        : selectedStaffId;

    if (!assignedStaffId) {
      setBookingError("No stylist available for this slot.");
      return;
    }

    setBookingError(null);
    startSubmitting(async () => {
      const res = await createAppointmentAction({
        salonSlug: salon.slug,
        serviceId: selectedService.id,
        staffId: assignedStaffId,
        startsAt: selectedSlot.startsAt,
        customerName,
        customerEmail,
        customerPhone,
        notes: customerNotes,
      });

      if (res.error) {
        setBookingError(res.error);
      } else if (res.success && res.appointment) {
        setConfirmedAppt(res.appointment);
        setCurrentStep(5);
      }
    });
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSelectedService(null);
    setSelectedStaffId("any");
    setSelectedSlot(null);
    setConfirmedAppt(null);
    setBookingError(null);
  };

  // Step 5: Confirmed Booking Celebration
  if (currentStep === 5 && confirmedAppt) {
    const apptDate = new Date(confirmedAppt.startsAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const startTime = new Date(confirmedAppt.startsAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const endTime = new Date(confirmedAppt.endsAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    return (
      <div className="rounded-3xl border border-emerald-500/30 bg-card p-8 sm:p-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-3xl">
          ✓
        </div>
        <p className="mt-4 text-xs font-semibold tracking-widest text-emerald-400 uppercase">
          Appointment Confirmed
        </p>
        <h2 className="mt-2 font-display text-3xl text-white">We look forward to seeing you!</h2>
        <p className="mt-2 text-sm text-muted">
          A confirmation has been recorded for{" "}
          <strong className="text-white">{confirmedAppt.customerEmail}</strong>.
        </p>

        {/* Details Card */}
        <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-line bg-background/50 p-6 text-left">
          <div className="flex justify-between items-baseline border-b border-line pb-4">
            <div>
              <p className="font-display text-xl text-white">{confirmedAppt.serviceName}</p>
              <p className="text-xs text-muted">With {confirmedAppt.staffName}</p>
            </div>
            <p className="font-display text-xl text-white">
              {formatPrice(confirmedAppt.servicePriceCents)}
            </p>
          </div>

          <div className="mt-4 space-y-2.5 text-sm text-muted">
            <div className="flex items-center gap-2">
              <span>📅</span>
              <span className="text-white font-medium">{apptDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⏰</span>
              <span className="text-white font-medium">
                {startTime} – {endTime} ({confirmedAppt.serviceDuration} min)
              </span>
            </div>
            {salon.addressLine && (
              <div className="flex items-center gap-2">
                <span>📍</span>
                <span className="text-white">
                  {salon.addressLine}, {salon.city}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 pt-2 text-xs">
              <span className="text-muted">Booking Reference:</span>
              <span className="font-mono text-accent">{confirmedAppt.id}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={handleReset}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Book Another Appointment
          </button>
          <Link
            href="/"
            className="rounded-full border border-line bg-card px-6 py-2.5 text-sm text-muted hover:text-white transition"
          >
            Return to Atelier Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Step Indicators */}
      <nav className="grid grid-cols-4 gap-2 sm:gap-4 border-b border-line pb-6">
        {[
          { num: 1, label: "Service" },
          { num: 2, label: "Stylist" },
          { num: 3, label: "Date & Time" },
          { num: 4, label: "Details" },
        ].map((s) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <div
              key={s.num}
              className={`border-b-2 pb-2 transition text-left ${
                isActive
                  ? "border-accent text-white"
                  : isDone
                  ? "border-white/40 text-muted"
                  : "border-transparent text-muted/40"
              }`}
            >
              <span className="text-[10px] uppercase font-mono tracking-wider">
                0{s.num} {isDone ? "✓" : ""}
              </span>
              <p className="text-xs sm:text-sm font-medium truncate">{s.label}</p>
            </div>
          );
        })}
      </nav>

      {/* Step 1: Service Selection */}
      {currentStep === 1 && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl text-white">Select a Service</h2>
            <p className="text-sm text-muted">Choose the treatment or styling service you need.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((srv) => (
              <div
                key={srv.id}
                onClick={() => handleSelectService(srv)}
                className="group cursor-pointer rounded-2xl border border-line bg-card p-6 transition hover:border-accent hover:bg-card/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-xl text-white group-hover:text-accent transition">
                      {srv.name}
                    </h3>
                    <span className="font-display text-lg text-white">
                      {formatPrice(srv.priceCents)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-accent font-medium">
                    {srv.durationMinutes} minutes
                  </p>
                  {srv.description && (
                    <p className="mt-3 text-xs leading-relaxed text-muted">{srv.description}</p>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent font-medium group-hover:bg-accent group-hover:text-white transition">
                    Select Service →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Step 2: Stylist Selection */}
      {currentStep === 2 && selectedService && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl text-white">Choose a Stylist</h2>
              <p className="text-sm text-muted">
                Stylists available for <span className="text-white">{selectedService.name}</span>.
              </p>
            </div>
            <button
              onClick={() => setCurrentStep(1)}
              className="text-xs text-muted hover:text-white underline"
            >
              ← Change Service
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Any Stylist Option */}
            <div
              onClick={() => handleSelectStaff("any")}
              className={`cursor-pointer rounded-2xl border p-5 transition ${
                selectedStaffId === "any"
                  ? "border-accent bg-accent/10 ring-1 ring-accent"
                  : "border-line bg-card hover:border-accent/50"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-accent text-lg">
                ★
              </div>
              <h3 className="mt-3 font-display text-lg text-white">Any Available Stylist</h3>
              <p className="mt-1 text-xs text-muted">
                Gives you the widest selection of open appointment times.
              </p>
              <span className="mt-4 inline-block text-xs text-accent font-medium">
                Choose →
              </span>
            </div>

            {/* Individual Stylists */}
            {eligibleStaff.map((member) => (
              <div
                key={member.id}
                onClick={() => handleSelectStaff(member.id)}
                className={`cursor-pointer rounded-2xl border p-5 transition ${
                  selectedStaffId === member.id
                    ? "border-accent bg-accent/10 ring-1 ring-accent"
                    : "border-line bg-card hover:border-accent/50"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-line text-sm font-semibold text-white">
                  {member.name.charAt(0)}
                </div>
                <h3 className="mt-3 font-display text-lg text-white">{member.name}</h3>
                <p className="mt-1 text-xs text-muted">{member.title || "Stylist"}</p>
                <span className="mt-4 inline-block text-xs text-accent font-medium">
                  Select Stylist →
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Step 3: Date & Slot Picker */}
      {currentStep === 3 && selectedService && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl text-white">Select Date & Time</h2>
              <p className="text-sm text-muted">
                {selectedService.name} ({selectedService.durationMinutes} min) with{" "}
                <span className="text-white">
                  {selectedStaffId === "any"
                    ? "Any Stylist"
                    : staff.find((s) => s.id === selectedStaffId)?.name}
                </span>
              </p>
            </div>
            <button
              onClick={() => setCurrentStep(2)}
              className="text-xs text-muted hover:text-white underline"
            >
              ← Change Stylist
            </button>
          </div>

          {/* Quick Date Chips */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {upcomingDays.map((d) => {
              const isSelected = selectedDate === d.dateStr;
              return (
                <button
                  type="button"
                  key={d.dateStr}
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={`flex flex-col items-center min-w-[80px] rounded-2xl border px-3 py-3 text-xs transition ${
                    isSelected
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-card text-muted hover:text-white hover:border-muted/50"
                  }`}
                >
                  <span className="font-semibold">{d.dayName}</span>
                  <span className="text-[11px] opacity-80 mt-0.5">{d.monthDay}</span>
                </button>
              );
            })}
          </div>

          {/* Slot Grid */}
          <div className="rounded-2xl border border-line bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider text-muted font-medium">
                Available Openings on {selectedDate}
              </span>
              {isLoadingSlots && (
                <span className="text-xs text-accent animate-pulse">Checking book...</span>
              )}
            </div>

            {availabilityError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
                {availabilityError}
              </div>
            )}

            {!isLoadingSlots && availability && !availability.isOpen && (
              <div className="py-8 text-center text-muted text-sm">
                <p>Salon is closed on this day.</p>
                <p className="mt-1 text-xs">Please select another date above.</p>
              </div>
            )}

            {!isLoadingSlots &&
              availability &&
              availability.isOpen &&
              availability.slots.length === 0 && (
                <div className="py-8 text-center text-muted text-sm">
                  <p>No open slots remaining on this day.</p>
                  <p className="mt-1 text-xs">
                    Try choosing &quot;Any Available Stylist&quot; or check upcoming dates.
                  </p>
                </div>
              )}

            {!isLoadingSlots && availability && availability.slots.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {availability.slots.map((slot) => {
                  return (
                    <button
                      type="button"
                      key={slot.time}
                      onClick={() => handleSelectSlot(slot)}
                      className="rounded-xl border border-line bg-background/60 py-3 text-center text-sm font-medium text-white transition hover:border-accent hover:bg-accent/10 focus:outline-none"
                    >
                      {slot.displayTime}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Step 4: Guest Details & Final Confirmation */}
      {currentStep === 4 && selectedService && selectedSlot && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl text-white">Your Contact Details</h2>
              <p className="text-sm text-muted">
                Complete your details to secure your reservation at {salon.name}.
              </p>
            </div>
            <button
              onClick={() => setCurrentStep(3)}
              className="text-xs text-muted hover:text-white underline"
            >
              ← Change Time
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Form */}
            <form onSubmit={handleConfirmBooking} className="md:col-span-2 space-y-4">
              {bookingError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
                  {bookingError}
                </div>
              )}

              <div>
                <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Taylor Smith"
                  className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="taylor@example.com"
                    className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                    Mobile Phone
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(555) 012-3456"
                    className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                  Special Notes or Requests (Optional)
                </label>
                <textarea
                  rows={3}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Hair length, styling goals, or sensitivity notes..."
                  className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-accent py-3.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? "Confirming appointment..." : "Confirm & Book Appointment"}
              </button>
            </form>

            {/* Reservation Summary */}
            <div className="rounded-2xl border border-line bg-card p-6 h-fit space-y-4">
              <span className="text-xs uppercase tracking-wider text-muted font-medium">
                Booking Summary
              </span>

              <div className="border-b border-line pb-4">
                <p className="font-display text-xl text-white">{selectedService.name}</p>
                <p className="text-xs text-accent mt-0.5">
                  {selectedService.durationMinutes} min • {formatPrice(selectedService.priceCents)}
                </p>
              </div>

              <div className="space-y-3 text-xs text-muted">
                <div>
                  <span className="block text-muted/60">Stylist</span>
                  <span className="text-white font-medium">
                    {selectedStaffId === "any"
                      ? `${selectedSlot.availableStaff[0]?.name || "Assigned Stylist"} (Auto-assigned)`
                      : staff.find((s) => s.id === selectedStaffId)?.name}
                  </span>
                </div>

                <div>
                  <span className="block text-muted/60">Date</span>
                  <span className="text-white font-medium">{selectedDate}</span>
                </div>

                <div>
                  <span className="block text-muted/60">Time Slot</span>
                  <span className="text-white font-medium">
                    {selectedSlot.displayTime} – {selectedSlot.displayEndTime}
                  </span>
                </div>

                <div>
                  <span className="block text-muted/60">Location</span>
                  <span className="text-white font-medium">
                    {salon.name}
                    {salon.addressLine && ` • ${salon.addressLine}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateAppointmentStatusAction,
  createManualAppointmentAction,
} from "@/app/actions/appointments";
import { AppointmentStatus } from "@/generated/prisma/enums";

export type SerializedAppointment = {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes: string | null;
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  };
  staff: {
    id: string;
    name: string;
    title: string | null;
  };
};

export type StaffOption = {
  id: string;
  name: string;
  title: string | null;
};

export type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
};

type Props = {
  selectedDate: string; // YYYY-MM-DD
  appointments: SerializedAppointment[];
  staffList: StaffOption[];
  servicesList: ServiceOption[];
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatTime(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function AppointmentsView({
  selectedDate,
  appointments,
  staffList,
  servicesList,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const [filterStaffId, setFilterStaffId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalServiceId, setModalServiceId] = useState(servicesList[0]?.id || "");
  const [modalStaffId, setModalStaffId] = useState(staffList[0]?.id || "");
  const [modalTime, setModalTime] = useState("10:00");
  const [modalCustomerName, setModalCustomerName] = useState("");
  const [modalCustomerEmail, setModalCustomerEmail] = useState("");
  const [modalCustomerPhone, setModalCustomerPhone] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  // Date Navigation
  const changeDate = (newDateStr: string) => {
    router.push(`/dashboard/appointments?date=${newDateStr}`);
  };

  const handlePrevDay = () => {
    const d = new Date(`${selectedDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    changeDate(d.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const d = new Date(`${selectedDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    changeDate(d.toISOString().split("T")[0]);
  };

  const handleToday = () => {
    const now = new Date();
    changeDate(now.toISOString().split("T")[0]);
  };

  // Status Action
  const handleStatusChange = (appointmentId: string, status: AppointmentStatus) => {
    startTransition(async () => {
      await updateAppointmentStatusAction(appointmentId, status);
      router.refresh();
    });
  };

  // Manual Booking Submit
  const handleManualBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    startTransition(async () => {
      const res = await createManualAppointmentAction({
        serviceId: modalServiceId,
        staffId: modalStaffId,
        dateStr: selectedDate,
        timeStr: modalTime,
        customerName: modalCustomerName,
        customerEmail: modalCustomerEmail || undefined,
        customerPhone: modalCustomerPhone || undefined,
        notes: modalNotes || undefined,
      });

      if (res.error) {
        setModalError(res.error);
      } else {
        setIsModalOpen(false);
        setModalCustomerName("");
        setModalCustomerEmail("");
        setModalCustomerPhone("");
        setModalNotes("");
        router.refresh();
      }
    });
  };

  // Filtered Appointments
  const filteredAppointments = appointments.filter((appt) => {
    if (filterStaffId !== "all" && appt.staff.id !== filterStaffId) return false;
    if (filterStatus !== "all" && appt.status !== filterStatus) return false;
    return true;
  });

  // Daily Metrics
  const totalRevenueCents = appointments
    .filter((a) => a.status === "COMPLETED" || a.status === "CONFIRMED")
    .reduce((sum, a) => sum + a.service.priceCents, 0);

  const confirmedCount = appointments.filter(
    (a) => a.status === "CONFIRMED" || a.status === "PENDING"
  ).length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;
  const noShowCount = appointments.filter((a) => a.status === "NO_SHOW").length;

  return (
    <div className="space-y-6">
      {/* Date Navigation & Actions Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevDay}
            className="rounded-xl border border-line bg-background/50 px-3 py-2 text-xs text-muted hover:text-white transition"
            title="Previous Day"
          >
            ←
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="rounded-xl border border-line bg-background/50 px-3.5 py-2 text-xs font-medium text-white hover:border-accent transition"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleNextDay}
            className="rounded-xl border border-line bg-background/50 px-3 py-2 text-xs text-muted hover:text-white transition"
            title="Next Day"
          >
            →
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => changeDate(e.target.value)}
            className="rounded-xl border border-line bg-background px-3 py-2 text-xs text-white focus:border-accent focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
        >
          + New Walk-in / Phone Booking
        </button>
      </div>

      {/* Daily Metrics Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Total Bookings</p>
          <p className="mt-1 font-display text-2xl text-white">{appointments.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-blue-400">Scheduled</p>
          <p className="mt-1 font-display text-2xl text-blue-400">{confirmedCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-emerald-400">Completed</p>
          <p className="mt-1 font-display text-2xl text-emerald-400">{completedCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-red-400">No-Shows</p>
          <p className="mt-1 font-display text-2xl text-red-400">{noShowCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Est. Revenue</p>
          <p className="mt-1 font-display text-2xl text-white">{formatPrice(totalRevenueCents)}</p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Stylist:</span>
          <select
            value={filterStaffId}
            onChange={(e) => setFilterStaffId(e.target.value)}
            className="rounded-xl border border-line bg-card px-3 py-1.5 text-xs text-white focus:border-accent focus:outline-none"
          >
            <option value="all">All Stylists ({staffList.length})</option>
            {staffList.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-line bg-card px-3 py-1.5 text-xs text-white focus:border-accent focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="CONFIRMED">Confirmed / Checked-in</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No-Show</option>
          </select>
        </div>

        {isPending && (
          <span className="ml-auto text-xs text-accent animate-pulse">Updating book...</span>
        )}
      </div>

      {/* Appointments List */}
      {filteredAppointments.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-12 text-center">
          <p className="font-display text-xl text-white">No Appointments Found</p>
          <p className="mt-2 text-sm text-muted">
            {appointments.length === 0
              ? `There are no bookings scheduled for ${selectedDate}.`
              : "No appointments match the current filter criteria."}
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-6 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-medium text-accent hover:bg-accent hover:text-white transition"
          >
            + Create Walk-in Booking
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((appt) => {
            const isConfirmed = appt.status === "CONFIRMED" || appt.status === "PENDING";
            const isCompleted = appt.status === "COMPLETED";
            const isCancelled = appt.status === "CANCELLED";
            const isNoShow = appt.status === "NO_SHOW";

            return (
              <div
                key={appt.id}
                className="rounded-2xl border border-line bg-card p-5 transition hover:border-muted/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Time & Client Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-white">
                        {formatTime(appt.startsAt)} – {formatTime(appt.endsAt)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${
                          isCompleted
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : isConfirmed
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : isNoShow
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-muted/20 text-muted border border-muted/30"
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>

                    <h3 className="font-display text-xl text-white pt-1">
                      {appt.customerName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      {appt.customerPhone && (
                        <a
                          href={`tel:${appt.customerPhone}`}
                          className="hover:text-accent transition"
                        >
                          📞 {appt.customerPhone}
                        </a>
                      )}
                      {appt.customerEmail && (
                        <a
                          href={`mailto:${appt.customerEmail}`}
                          className="hover:text-accent transition"
                        >
                          ✉️ {appt.customerEmail}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Service & Stylist Info */}
                  <div className="text-right sm:text-right">
                    <p className="font-display text-lg text-white">{appt.service.name}</p>
                    <p className="text-xs text-accent mt-0.5">
                      {appt.service.durationMinutes} min • {formatPrice(appt.service.priceCents)}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Stylist: <span className="text-white font-medium">{appt.staff.name}</span>
                    </p>
                  </div>
                </div>

                {appt.notes && (
                  <div className="mt-3 rounded-xl border border-line bg-background/50 px-3.5 py-2 text-xs text-muted">
                    <span className="font-medium text-white/80">Notes:</span> {appt.notes}
                  </div>
                )}

                {/* Quick Action Buttons */}
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
                  {isConfirmed && (
                    <>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleStatusChange(appt.id, "COMPLETED")}
                        className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30 transition disabled:opacity-50"
                      >
                        ✓ Mark Completed
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleStatusChange(appt.id, "NO_SHOW")}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
                      >
                        Mark No-Show
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleStatusChange(appt.id, "CANCELLED")}
                        className="rounded-lg px-2.5 py-1.5 text-xs text-muted hover:text-white transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {(isCancelled || isNoShow) && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleStatusChange(appt.id, "CONFIRMED")}
                      className="rounded-lg border border-line bg-background px-3 py-1.5 text-xs text-muted hover:text-white transition disabled:opacity-50"
                    >
                      ↺ Restore to Confirmed
                    </button>
                  )}

                  {isCompleted && (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      ✓ Service Completed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-card p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <h3 className="font-display text-xl text-white">Manual Appointment Booking</h3>
                <p className="text-xs text-muted">Record a walk-in or phone reservation</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-white text-lg select-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualBooking} className="mt-5 space-y-4">
              {modalError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                  Service *
                </label>
                <select
                  value={modalServiceId}
                  onChange={(e) => setModalServiceId(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-white focus:border-accent focus:outline-none"
                >
                  {servicesList.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} ({svc.durationMinutes} min • {formatPrice(svc.priceCents)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                  Stylist *
                </label>
                <select
                  value={modalStaffId}
                  onChange={(e) => setModalStaffId(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-white focus:border-accent focus:outline-none"
                >
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} {st.title ? `(${st.title})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                    Date
                  </label>
                  <input
                    type="date"
                    disabled
                    value={selectedDate}
                    className="mt-1.5 w-full rounded-xl border border-line bg-background/50 px-3.5 py-2.5 text-sm text-muted"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-white focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Alex Rivera"
                  value={modalCustomerName}
                  onChange={(e) => setModalCustomerName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 019-2834"
                    value={modalCustomerPhone}
                    onChange={(e) => setModalCustomerPhone(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="alex@example.com"
                    value={modalCustomerEmail}
                    onChange={(e) => setModalCustomerEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-medium tracking-wider text-muted">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Walk-in, requested Elena, allergic to latex..."
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-line px-4 py-2 text-xs text-muted hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "Scheduling..." : "Save Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

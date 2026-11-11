"use client";

import { useState, useTransition } from "react";
import {
  createServiceAction,
  updateServiceAction,
  toggleServiceActiveAction,
  deleteServiceAction,
  type CreateServiceInput,
} from "@/app/actions/services";

export type StaffMemberOption = {
  id: string;
  name: string;
  title: string | null;
  active: boolean;
};

export type ServiceWithStaff = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
  staffIds: string[];
  appointmentCount: number;
};

type Props = {
  services: ServiceWithStaff[];
  allStaff: StaffMemberOption[];
};

const COMMON_DURATIONS = [15, 30, 45, 60, 75, 90, 120];

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

// ─── Modal / Form for Creating or Editing a Service ─────────────────────────

type ServiceFormModalProps = {
  initialService?: ServiceWithStaff | null;
  allStaff: StaffMemberOption[];
  onClose: () => void;
  onSuccess: (saved: ServiceWithStaff) => void;
};

function ServiceFormModal({
  initialService,
  allStaff,
  onClose,
  onSuccess,
}: ServiceFormModalProps) {
  const isEditing = Boolean(initialService);
  const [name, setName] = useState(initialService?.name ?? "");
  const [description, setDescription] = useState(initialService?.description ?? "");
  const [durationMinutes, setDurationMinutes] = useState(
    initialService?.durationMinutes ?? 45
  );
  const [customDuration, setCustomDuration] = useState(
    !COMMON_DURATIONS.includes(initialService?.durationMinutes ?? 45)
  );
  const [priceDollars, setPriceDollars] = useState(
    initialService ? (initialService.priceCents / 100).toString() : "65"
  );
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(
    new Set(initialService?.staffIds ?? allStaff.map((s) => s.id))
  );
  const [active, setActive] = useState(initialService?.active ?? true);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleStaff(id: string) {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAllStaff() {
    setSelectedStaffIds(new Set(allStaff.map((s) => s.id)));
  }

  function handleDeselectAllStaff() {
    setSelectedStaffIds(new Set());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsedPrice = parseFloat(priceDollars);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Please provide a valid price.");
      return;
    }
    const priceCents = Math.round(parsedPrice * 100);

    startTransition(async () => {
      if (isEditing && initialService) {
        const result = await updateServiceAction(initialService.id, {
          name,
          description,
          durationMinutes,
          priceCents,
          active,
          staffIds: Array.from(selectedStaffIds),
        });

        if (result.error) {
          setError(result.error);
        } else {
          onSuccess({
            ...initialService,
            name: name.trim(),
            description: description.trim() || null,
            durationMinutes,
            priceCents,
            active,
            staffIds: Array.from(selectedStaffIds),
          });
          onClose();
        }
      } else {
        const input: CreateServiceInput = {
          name,
          description: description || undefined,
          durationMinutes,
          priceCents,
          staffIds: Array.from(selectedStaffIds),
        };

        const result = await createServiceAction(input);
        if (result.error) {
          setError(result.error);
        } else {
          onSuccess({
            id: `temp-${Date.now()}`,
            name: name.trim(),
            description: description.trim() || null,
            durationMinutes,
            priceCents,
            active: true,
            staffIds: Array.from(selectedStaffIds),
            appointmentCount: 0,
          });
          onClose();
        }
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <h2 className="text-xl font-display text-white">
            {isEditing ? "Edit Service" : "New Service"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-white transition text-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
              Service Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Signature Blowout & Style"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
              Description (optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief explanation shown on the booking wizard..."
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none resize-none"
            />
          </div>

          {/* Duration & Price Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
                Duration (minutes) <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_DURATIONS.map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => {
                      setDurationMinutes(dur);
                      setCustomDuration(false);
                    }}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      !customDuration && durationMinutes === dur
                        ? "bg-accent text-black font-semibold"
                        : "bg-surface border border-line text-muted hover:text-white"
                    }`}
                  >
                    {dur}m
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomDuration(true)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                    customDuration
                      ? "bg-accent text-black font-semibold"
                      : "bg-surface border border-line text-muted hover:text-white"
                  }`}
                >
                  Custom
                </button>
              </div>

              {customDuration && (
                <input
                  type="number"
                  min="5"
                  step="5"
                  required
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 15)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                />
              )}
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
                Price (USD) <span className="text-red-400">*</span>
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-muted text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-line bg-surface pl-7 pr-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Active status toggle (if editing) */}
          {isEditing && (
            <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Active Status</p>
                <p className="text-xs text-muted">
                  {active
                    ? "Available for clients to book online"
                    : "Hidden from booking catalog"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActive(!active)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
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
          )}

          {/* Stylist Assignment */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted uppercase tracking-wider">
                Qualified Stylists ({selectedStaffIds.size}/{allStaff.length})
              </label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllStaff}
                  className="text-accent hover:underline"
                >
                  Select all
                </button>
                <span className="text-muted">·</span>
                <button
                  type="button"
                  onClick={handleDeselectAllStaff}
                  className="text-muted hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>

            {allStaff.length === 0 ? (
              <p className="rounded-lg border border-line bg-surface p-3 text-xs text-muted">
                No stylists registered yet. You can assign stylists later from the Staff
                tab.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-line bg-surface p-2">
                {allStaff.map((staff) => (
                  <label
                    key={staff.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md p-2 transition text-xs ${
                      selectedStaffIds.has(staff.id)
                        ? "bg-accent/10 border border-accent/40 text-white"
                        : "border border-transparent text-muted hover:bg-card"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStaffIds.has(staff.id)}
                      onChange={() => toggleStaff(staff.id)}
                      className="accent-accent h-3.5 w-3.5"
                    />
                    <div className="truncate">
                      <p className="font-medium truncate">{staff.name}</p>
                      {staff.title && (
                        <p className="text-[10px] text-muted truncate">{staff.title}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-800/50 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-full border border-line px-4 py-2 text-xs font-medium text-muted hover:text-white transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-black hover:bg-accent/90 transition disabled:opacity-50"
            >
              {isPending
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                ? "Save Changes"
                : "Create Service"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main View ──────────────────────────────────────────────────────────────

export function ServicesView({
  services: initialServices,
  allStaff,
}: Props) {
  const [services, setServices] = useState<ServiceWithStaff[]>(initialServices);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceWithStaff | null>(null);
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const displayedServices = filterActiveOnly
    ? services.filter((s) => s.active)
    : services;

  function showMessage(msg: string) {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  }

  function handleOpenCreate() {
    setEditingService(null);
    setModalOpen(true);
  }

  function handleOpenEdit(service: ServiceWithStaff) {
    setEditingService(service);
    setModalOpen(true);
  }

  function handleSaved(saved: ServiceWithStaff) {
    setServices((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    showMessage(`Service "${saved.name}" saved successfully.`);
  }

  function handleToggleActive(service: ServiceWithStaff) {
    const nextState = !service.active;
    startTransition(async () => {
      const result = await toggleServiceActiveAction(service.id, nextState);
      if (result.error) {
        showMessage(result.error);
      } else {
        setServices((prev) =>
          prev.map((s) => (s.id === service.id ? { ...s, active: nextState } : s))
        );
        showMessage(
          `Service "${service.name}" is now ${nextState ? "active" : "archived"}.`
        );
      }
    });
  }

  function handleDelete(service: ServiceWithStaff) {
    const confirmMsg =
      service.appointmentCount > 0
        ? `"${service.name}" has ${service.appointmentCount} bookings and will be archived instead of deleted. Proceed?`
        : `Are you sure you want to delete "${service.name}"? This action cannot be undone.`;

    if (!window.confirm(confirmMsg)) return;

    startTransition(async () => {
      const result = await deleteServiceAction(service.id);
      if (result.error && !result.success) {
        showMessage(result.error);
      } else {
        if (result.error && result.success) {
          // Archived because appointments exist
          setServices((prev) =>
            prev.map((s) => (s.id === service.id ? { ...s, active: false } : s))
          );
          showMessage(result.error);
        } else {
          // Hard deleted
          setServices((prev) => prev.filter((s) => s.id !== service.id));
          showMessage(`Service "${service.name}" deleted.`);
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Action banner feedback */}
      {actionMessage && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          {actionMessage}
        </div>
      )}

      {/* Control bar: search, toggle inactive, create button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted hover:text-white transition">
            <input
              type="checkbox"
              checked={filterActiveOnly}
              onChange={(e) => setFilterActiveOnly(e.target.checked)}
              className="accent-accent h-3.5 w-3.5"
            />
            Show active only
          </label>
          <span className="text-xs text-muted">
            • {displayedServices.length} of {services.length} services shown
          </span>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-black hover:bg-accent/90 transition shadow-sm"
        >
          + Add New Service
        </button>
      </div>

      {/* Services Grid */}
      {displayedServices.length === 0 ? (
        <div className="rounded-2xl border border-line border-dashed p-12 text-center">
          <p className="font-display text-lg text-white">No services found</p>
          <p className="mt-1 text-sm text-muted">
            {filterActiveOnly
              ? "All your services are currently archived."
              : "Create your first salon service to enable client bookings."}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-4 rounded-full bg-accent px-5 py-2 text-xs font-semibold text-black hover:bg-accent/90 transition"
          >
            Create Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedServices.map((service) => {
            const assignedStylists = allStaff.filter((st) =>
              service.staffIds.includes(st.id)
            );

            return (
              <div
                key={service.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                  service.active
                    ? "border-line bg-card hover:border-accent/40"
                    : "border-line/40 bg-card/40 opacity-70"
                }`}
              >
                <div>
                  {/* Top line: Name + status badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg text-white font-medium">
                        {service.name}
                      </h3>
                      {service.description && (
                        <p className="mt-1 text-xs text-muted line-clamp-2">
                          {service.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        service.active
                          ? "bg-green-900/40 text-green-400 border border-green-800/40"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      }`}
                    >
                      {service.active ? "Active" : "Archived"}
                    </span>
                  </div>

                  {/* Metrics: Duration and Price */}
                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-white font-medium">
                      <span className="text-muted text-xs">⏱</span>
                      {service.durationMinutes} min
                    </div>
                    <span className="text-muted">•</span>
                    <div className="font-semibold text-accent">
                      {formatCents(service.priceCents)}
                    </div>
                    {service.appointmentCount > 0 && (
                      <>
                        <span className="text-muted">•</span>
                        <div className="text-xs text-muted">
                          {service.appointmentCount} booking
                          {service.appointmentCount !== 1 ? "s" : ""}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Qualified Staff */}
                  <div className="mt-4 border-t border-line/60 pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
                      Offered by:
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {assignedStylists.length === 0 ? (
                        <span className="text-xs text-amber-400/80 italic">
                          No stylists assigned (unbookable)
                        </span>
                      ) : (
                        assignedStylists.map((st) => (
                          <span
                            key={st.id}
                            className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs text-zinc-300"
                          >
                            {st.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Card actions */}
                <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(service)}
                      disabled={isPending}
                      className="text-muted hover:text-white transition disabled:opacity-50"
                    >
                      {service.active ? "Archive" : "Activate"}
                    </button>
                    <span className="text-muted">·</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(service)}
                      disabled={isPending}
                      className="text-red-400 hover:text-red-300 transition disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(service)}
                    className="rounded-full border border-line bg-surface px-3 py-1 font-medium text-white hover:border-accent hover:text-accent transition"
                  >
                    Edit Service
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ServiceFormModal
          initialService={editingService}
          allStaff={allStaff}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSaved}
        />
      )}
    </div>
  );
}

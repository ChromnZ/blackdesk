"use client";

import { Modal } from "@/components/ui/modal";
import { toLocalInputValue } from "@/lib/utils";
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useEffect, useMemo, useState } from "react";

type EventRecord = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  notes: string | null;
};

type EventForm = {
  id?: string;
  title: string;
  startAt: string;
  endAt: string;
  notes: string;
};

function defaultEventForm(start?: Date, end?: Date): EventForm {
  const startAt = start ?? new Date();
  const endAt = end ?? new Date(startAt.getTime() + 60 * 60 * 1000);

  return {
    title: "",
    startAt: toLocalInputValue(startAt),
    endAt: toLocalInputValue(endAt),
    notes: "",
  };
}

export function CalendarView() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(defaultEventForm());
  const [isSaving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);

    const response = await fetch("/api/events", { cache: "no-store" });
    if (!response.ok) {
      setError("Unable to load calendar events.");
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as EventRecord[];
    setEvents(payload);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const calendarEvents = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startAt,
        end: event.endAt,
        extendedProps: {
          notes: event.notes,
        },
      })),
    [events],
  );

  function openCreateModal(start?: Date, end?: Date) {
    setForm(defaultEventForm(start, end));
    setModalOpen(true);
  }

  function openEditModal(event: EventRecord) {
    setForm({
      id: event.id,
      title: event.title,
      startAt: toLocalInputValue(event.startAt),
      endAt: toLocalInputValue(event.endAt),
      notes: event.notes ?? "",
    });
    setModalOpen(true);
  }

  function onSelect(selection: DateSelectArg) {
    openCreateModal(selection.start, selection.end);
  }

  function onEventClick(info: EventClickArg) {
    const matched = events.find((event) => event.id === info.event.id);
    if (!matched) {
      return;
    }
    openEditModal(matched);
  }

  async function onEventMoveOrResize(info: EventDropArg | EventResizeDoneArg) {
    const start = info.event.start;
    if (!start) {
      info.revert();
      return;
    }

    const end = info.event.end ?? new Date(start.getTime() + 60 * 60 * 1000);

    const response = await fetch(`/api/events/${info.event.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      }),
    });

    if (!response.ok) {
      info.revert();
      return;
    }

    const updated = (await response.json()) as EventRecord;
    setEvents((current) =>
      current.map((event) => (event.id === updated.id ? updated : event)),
    );
  }

  async function saveEvent() {
    setError(null);

    const title = form.title.trim();
    if (!title) {
      setError("Event title is required.");
      return;
    }

    const startAt = new Date(form.startAt);
    const endAt = new Date(form.endAt);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setError("Start and end times are required.");
      return;
    }

    if (startAt >= endAt) {
      setError("End time must be after start time.");
      return;
    }

    setSaving(true);

    const response = await fetch(form.id ? `/api/events/${form.id}` : "/api/events", {
      method: form.id ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        notes: form.notes.trim(),
      }),
    });

    setSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to save event.");
      return;
    }

    const saved = (await response.json()) as EventRecord;

    setEvents((current) => {
      if (form.id) {
        return current.map((event) => (event.id === saved.id ? saved : event));
      }
      return [...current, saved];
    });

    setModalOpen(false);
    setForm(defaultEventForm());
  }

  async function deleteEvent() {
    if (!form.id) {
      return;
    }

    setSaving(true);

    const response = await fetch(`/api/events/${form.id}`, {
      method: "DELETE",
    });

    setSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to delete event.");
      return;
    }

    setEvents((current) => current.filter((event) => event.id !== form.id));
    setModalOpen(false);
    setForm(defaultEventForm());
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-textMuted">Private events with drag-and-drop scheduling.</p>
        </div>

        <button
          type="button"
          onClick={() => openCreateModal()}
          className="rounded-md border border-accent/25 bg-accent px-4 py-2 text-sm font-semibold text-accentText transition hover:bg-accent/90"
        >
          New event
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-border bg-panel p-3 shadow-glow sm:p-4">
        {isLoading ? (
          <p className="py-16 text-center text-sm text-textMuted">Loading calendar...</p>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            selectable
            editable
            selectMirror
            dayMaxEvents
            events={calendarEvents}
            select={onSelect}
            eventClick={onEventClick}
            eventDrop={onEventMoveOrResize}
            eventResize={onEventMoveOrResize}
            height="auto"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
          />
        )}
      </div>

      <Modal
        title={form.id ? "Edit event" : "Create event"}
        open={isModalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            {form.id && (
              <button
                type="button"
                onClick={() => void deleteEvent()}
                disabled={isSaving}
                className="rounded-md border border-red-700/50 bg-red-900/20 px-4 py-2 text-sm text-red-300 transition hover:bg-red-900/35 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-border bg-panelSoft px-4 py-2 text-sm text-textMain transition hover:bg-panelSoft"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveEvent()}
              disabled={isSaving}
              className="rounded-md border border-accent/25 bg-accent px-4 py-2 text-sm font-semibold text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void saveEvent();
          }}
        >
          <div>
            <label htmlFor="event-title" className="mb-1 block text-sm text-textMuted">
              Title
            </label>
            <input
              id="event-title"
              required
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="event-start" className="mb-1 block text-sm text-textMuted">
                Start
              </label>
              <input
                id="event-start"
                type="datetime-local"
                required
                value={form.startAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, startAt: event.target.value }))
                }
                className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
              />
            </div>

            <div>
              <label htmlFor="event-end" className="mb-1 block text-sm text-textMuted">
                End
              </label>
              <input
                id="event-end"
                type="datetime-local"
                required
                value={form.endAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, endAt: event.target.value }))
                }
                className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
              />
            </div>
          </div>

          <div>
            <label htmlFor="event-notes" className="mb-1 block text-sm text-textMuted">
              Notes
            </label>
            <textarea
              id="event-notes"
              rows={4}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              className="w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
              placeholder="Optional details"
            />
          </div>
        </form>
      </Modal>
    </section>
  );
}


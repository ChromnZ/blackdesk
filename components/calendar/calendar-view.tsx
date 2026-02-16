"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Separator } from "@/components/ui/Separator";
import { swrFetcher } from "@/lib/swr-fetcher";
import { normalizeTags, tagsToInput } from "@/lib/tags";
import { cn, toLocalInputValue } from "@/lib/utils";
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type EventResizeDoneArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import rrulePlugin from "@fullcalendar/rrule";
import timeGridPlugin from "@fullcalendar/timegrid";
import {
  Bell,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import useSWR from "swr";

type CalendarRecord = {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};

type EventReminderRecord = {
  id: string;
  minutesBefore: number;
  method: "inapp" | "email";
  firedAt: string | null;
};

type EventRecord = {
  id: string;
  userId: string;
  calendarId: string;
  parentEventId: string | null;
  originalOccurrenceStart: string | null;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  notes: string | null;
  color: string | null;
  eventType: "default" | "focus" | "outOfOffice" | "workingLocation";
  workingLocationLabel: string | null;
  timezone: string | null;
  recurrenceRule: string | null;
  recurrenceUntil: string | null;
  recurrenceCount: number | null;
  exdates: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  reminders: EventReminderRecord[];
};

type EventsResponse = {
  events: EventRecord[];
  range: {
    start: string;
    end: string;
  };
};

type SearchResult = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  calendarId: string;
  location: string | null;
  description: string | null;
};

type ReminderDraft = {
  id?: string;
  minutesBefore: number;
  method: "inapp" | "email";
};

type RepeatPreset = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";
type RepeatEndMode = "never" | "onDate" | "afterCount";
type EditorScope = "series" | "single";

type RepeatConfig = {
  preset: RepeatPreset;
  interval: number;
  weekdays: number[];
  endMode: RepeatEndMode;
  untilDate: string;
  count: number;
};

type EventEditorState = {
  id: string | null;
  scope: EditorScope;
  occurrenceStart: string | null;
  calendarId: string;
  title: string;
  allDay: boolean;
  startInput: string;
  endInput: string;
  location: string;
  description: string;
  notes: string;
  color: string;
  eventType: "default" | "focus" | "outOfOffice" | "workingLocation";
  workingLocationLabel: string;
  timezone: string;
  repeat: RepeatConfig;
  reminders: ReminderDraft[];
  tagsInput: string;
};

type QuickEventState = {
  title: string;
  allDay: boolean;
  startInput: string;
  endInput: string;
  calendarId: string;
};

type CalendarViewKey = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";

const VIEW_OPTIONS: Array<{ key: CalendarViewKey; label: string }> = [
  { key: "dayGridMonth", label: "Month" },
  { key: "timeGridWeek", label: "Week" },
  { key: "timeGridDay", label: "Day" },
  { key: "listWeek", label: "Schedule" },
];

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_RRULE = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const RRuleWeekdayToIndex: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const EVENT_TYPE_OPTIONS: Array<{ value: EventEditorState["eventType"]; label: string }> = [
  { value: "default", label: "Default" },
  { value: "focus", label: "Focus time" },
  { value: "outOfOffice", label: "Out of office" },
  { value: "workingLocation", label: "Working location" },
];

const REPEAT_PRESET_OPTIONS: Array<{ value: RepeatPreset; label: string }> = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const CALENDAR_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ec4899",
  "#a855f7",
  "#14b8a6",
  "#64748b",
];

const REMINDER_QUICK_VALUES = [5, 10, 30, 60, 120, 1440];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInputValue(date: Date | string) {
  const parsed = new Date(date);
  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseDateInput(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toEditorStartInput(date: Date | string, allDay: boolean) {
  return allDay ? toDateInputValue(date) : toLocalInputValue(date);
}

function toEditorEndInput(date: Date | string, allDay: boolean) {
  if (!allDay) {
    return toLocalInputValue(date);
  }

  const exclusive = new Date(date);
  const inclusive = addDays(exclusive, -1);
  return toDateInputValue(inclusive);
}

function formatDateTimeLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function startOfMiniMonthGrid(monthCursor: Date) {
  const firstOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const offset = firstOfMonth.getDay();
  return addDays(firstOfMonth, -offset);
}

function buildMiniMonthGrid(monthCursor: Date) {
  const start = startOfMiniMonthGrid(monthCursor);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function isSameDay(a: Date | string, b: Date | string) {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function toRRuleDateToken(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  const hour = String(value.getUTCHours()).padStart(2, "0");
  const minute = String(value.getUTCMinutes()).padStart(2, "0");
  const second = String(value.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function fromRRuleDateToken(token: string) {
  const match = token.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) {
    return null;
  }

  const parsed = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    ),
  );

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseRuleTokens(rule: string) {
  const normalized = rule.toUpperCase();
  const freq = normalized.match(/FREQ=([A-Z]+)/)?.[1] ?? null;
  const intervalRaw = normalized.match(/INTERVAL=(\d+)/)?.[1] ?? null;
  const byDayRaw = normalized.match(/BYDAY=([A-Z,]+)/)?.[1] ?? null;
  const untilRaw = normalized.match(/UNTIL=([0-9TZ]+)/)?.[1] ?? null;
  const countRaw = normalized.match(/COUNT=(\d+)/)?.[1] ?? null;

  return {
    freq,
    interval: intervalRaw ? Number(intervalRaw) : 1,
    weekdays: byDayRaw
      ? byDayRaw
          .split(",")
          .map((token) => RRuleWeekdayToIndex[token])
          .filter((item): item is number => Number.isInteger(item))
      : [],
    untilDate: untilRaw ? fromRRuleDateToken(untilRaw) : null,
    count: countRaw ? Number(countRaw) : null,
  };
}

function parseRepeatFromRule(rule: string | null): RepeatConfig {
  const fallback: RepeatConfig = {
    preset: "none",
    interval: 1,
    weekdays: [],
    endMode: "never",
    untilDate: "",
    count: 5,
  };

  if (!rule) {
    return fallback;
  }

  const parsed = parseRuleTokens(rule);
  const interval = Number.isFinite(parsed.interval) && parsed.interval > 0 ? parsed.interval : 1;

  let preset: RepeatPreset = "custom";
  if (parsed.freq === "DAILY" && interval === 1 && parsed.weekdays.length === 0) {
    preset = "daily";
  } else if (parsed.freq === "WEEKLY" && interval === 1) {
    preset = "weekly";
  } else if (parsed.freq === "MONTHLY" && interval === 1) {
    preset = "monthly";
  } else if (parsed.freq === "YEARLY" && interval === 1) {
    preset = "yearly";
  }

  const untilDate = parsed.untilDate ? toDateInputValue(parsed.untilDate) : "";

  return {
    preset,
    interval,
    weekdays: parsed.weekdays,
    endMode: (parsed.count ? "afterCount" : parsed.untilDate ? "onDate" : "never") as RepeatEndMode,
    untilDate,
    count: parsed.count ?? 5,
  };
}

function buildRepeatRule(params: {
  repeat: RepeatConfig;
  startAt: Date;
  allDay: boolean;
}) {
  if (params.repeat.preset === "none") {
    return {
      recurrenceRule: null,
      recurrenceUntil: null,
      recurrenceCount: null,
    };
  }

  let frequency = "DAILY";
  if (params.repeat.preset === "weekly") {
    frequency = "WEEKLY";
  } else if (params.repeat.preset === "monthly") {
    frequency = "MONTHLY";
  } else if (params.repeat.preset === "yearly") {
    frequency = "YEARLY";
  } else if (params.repeat.preset === "custom") {
    frequency = "WEEKLY";
  }

  const tokens = [`FREQ=${frequency}`];

  const normalizedInterval = Math.max(1, Math.trunc(params.repeat.interval || 1));
  if (normalizedInterval > 1) {
    tokens.push(`INTERVAL=${normalizedInterval}`);
  }

  const weekdays =
    params.repeat.weekdays.length > 0
      ? [...params.repeat.weekdays].sort((a, b) => a - b)
      : frequency === "WEEKLY"
        ? [params.startAt.getDay()]
        : [];

  if (frequency === "WEEKLY" && weekdays.length > 0) {
    tokens.push(`BYDAY=${weekdays.map((day) => WEEKDAY_RRULE[day]).join(",")}`);
  }

  let recurrenceUntil: Date | null = null;
  let recurrenceCount: number | null = null;

  if (params.repeat.endMode === "onDate" && params.repeat.untilDate) {
    const until = parseDateInput(params.repeat.untilDate);
    if (until) {
      if (params.allDay) {
        until.setHours(23, 59, 59, 0);
      } else {
        until.setHours(
          params.startAt.getHours(),
          params.startAt.getMinutes(),
          params.startAt.getSeconds(),
          0,
        );
      }
      recurrenceUntil = until;
      tokens.push(`UNTIL=${toRRuleDateToken(until)}`);
    }
  }

  if (params.repeat.endMode === "afterCount") {
    recurrenceCount = Math.max(1, Math.trunc(params.repeat.count || 1));
    tokens.push(`COUNT=${recurrenceCount}`);
  }

  const recurrenceRule = `DTSTART:${toRRuleDateToken(params.startAt)}\nRRULE:${tokens.join(";")}`;

  return {
    recurrenceRule,
    recurrenceUntil,
    recurrenceCount,
  };
}

function toIsoDuration(start: string, end: string) {
  const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const totalMinutes = Math.max(1, Math.round(diff / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `PT${hours}H${minutes}M`;
  }
  if (hours > 0) {
    return `PT${hours}H`;
  }
  return `PT${minutes}M`;
}

function parseEditorDate(value: string, allDay: boolean, isEnd: boolean) {
  if (allDay) {
    const parsed = parseDateInput(value);
    if (!parsed) {
      return null;
    }
    if (isEnd) {
      return addDays(parsed, 1);
    }
    return parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

function defaultQuickState(calendarId: string) {
  const start = new Date();
  start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return {
    title: "",
    allDay: false,
    startInput: toEditorStartInput(start, false),
    endInput: toEditorEndInput(end, false),
    calendarId,
  } satisfies QuickEventState;
}

function buildEditorFromQuick(args: {
  quick: QuickEventState;
  timezone: string;
  color?: string;
}) {
  return {
    id: null,
    scope: "series",
    occurrenceStart: null,
    calendarId: args.quick.calendarId,
    title: args.quick.title,
    allDay: args.quick.allDay,
    startInput: args.quick.startInput,
    endInput: args.quick.endInput,
    location: "",
    description: "",
    notes: "",
    color: args.color ?? "",
    eventType: "default",
    workingLocationLabel: "",
    timezone: args.timezone,
    repeat: {
      preset: "none",
      interval: 1,
      weekdays: [],
      endMode: "never",
      untilDate: "",
      count: 5,
    },
    reminders: [{ minutesBefore: 10, method: "inapp" }],
    tagsInput: "",
  } satisfies EventEditorState;
}

export function CalendarView() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const firedReminderIdsRef = useRef(new Set<string>());

  const [actionError, setActionError] = useState<string | null>(null);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [calendarTitle, setCalendarTitle] = useState("Calendar");
  const [currentView, setCurrentView] = useState<CalendarViewKey>("dayGridMonth");
  const [focusedDate, setFocusedDate] = useState(new Date());
  const [miniMonthCursor, setMiniMonthCursor] = useState(() => new Date());

  const [visibleCalendarIds, setVisibleCalendarIds] = useState<string[]>([]);
  const [activeCalendarId, setActiveCalendarId] = useState<string>("");

  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [quickDraft, setQuickDraft] = useState<QuickEventState | null>(null);
  const [isQuickSaving, setQuickSaving] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorState, setEditorState] = useState<EventEditorState | null>(null);
  const [isEditorSaving, setEditorSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);

  const [addCalendarOpen, setAddCalendarOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState("");
  const [newCalendarColor, setNewCalendarColor] = useState(CALENDAR_COLORS[0]);
  const [isCreatingCalendar, setCreatingCalendar] = useState(false);

  const displayTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    [],
  );

  const {
    data: calendarsResponse,
    error: calendarsError,
    isLoading: calendarsLoading,
    mutate: mutateCalendars,
  } = useSWR<{ calendars: CalendarRecord[] }>("/api/calendars", swrFetcher);

  const calendars = useMemo(() => calendarsResponse?.calendars ?? [], [calendarsResponse?.calendars]);

  useEffect(() => {
    if (calendars.length === 0) {
      return;
    }

    setVisibleCalendarIds((current) => {
      if (current.length === 0) {
        return calendars.map((calendar) => calendar.id);
      }

      const currentSet = new Set(current);
      for (const calendar of calendars) {
        currentSet.add(calendar.id);
      }

      return [...currentSet].filter((id) => calendars.some((calendar) => calendar.id === id));
    });

    setActiveCalendarId((current) => {
      if (current && calendars.some((calendar) => calendar.id === current)) {
        return current;
      }
      return calendars[0]?.id ?? "";
    });
  }, [calendars]);

  const visibleCalendarIdsParam = useMemo(() => visibleCalendarIds.join(","), [visibleCalendarIds]);

  const eventsEndpoint = useMemo(() => {
    if (!range) {
      return null;
    }

    const searchParams = new URLSearchParams({
      start: range.start,
      end: range.end,
    });

    if (visibleCalendarIdsParam) {
      searchParams.set("calendarIds", visibleCalendarIdsParam);
    }

    return `/api/events?${searchParams.toString()}`;
  }, [range, visibleCalendarIdsParam]);

  const {
    data: eventsResponse,
    error: eventsError,
    isLoading: eventsLoading,
    mutate: mutateEvents,
  } = useSWR<EventsResponse>(eventsEndpoint, swrFetcher);

  const events = useMemo(() => eventsResponse?.events ?? [], [eventsResponse?.events]);

  const calendarColorMap = useMemo(() => {
    const entries = calendars.map((calendar) => [calendar.id, calendar.color] as const);
    return Object.fromEntries(entries);
  }, [calendars]);

  const mappedEvents = useMemo(() => {
    return events.map((event) => {
      const color = event.color ?? calendarColorMap[event.calendarId] ?? "#3b82f6";
      const common = {
        id: event.id,
        title: event.title,
        allDay: event.allDay,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          record: event,
        },
      };

      if (event.recurrenceRule && !event.parentEventId) {
        return {
          ...common,
          rrule: event.recurrenceRule,
          duration: toIsoDuration(event.startAt, event.endAt),
          exdate: event.exdates,
        };
      }

      return {
        ...common,
        start: event.startAt,
        end: event.endAt,
      };
    });
  }, [events, calendarColorMap]);

  const resultsError = actionError ?? eventsError?.message ?? calendarsError?.message ?? null;

  const openQuickModal = useCallback(
    (startDate: Date, endDate: Date, allDay: boolean) => {
      const calendarId = activeCalendarId || calendars[0]?.id || "";
      const nextQuick: QuickEventState = {
        title: "",
        allDay,
        startInput: toEditorStartInput(startDate, allDay),
        endInput: toEditorEndInput(endDate, allDay),
        calendarId,
      };

      setQuickDraft(nextQuick);
      setQuickModalOpen(true);
      setActionError(null);
    },
    [activeCalendarId, calendars],
  );

  const openEditor = useCallback((editor: EventEditorState) => {
    setEditorState(editor);
    setEditorOpen(true);
    setActionError(null);
  }, []);

  const openEditorFromEvent = useCallback(
    (record: EventRecord, occurrenceStart?: string | null, occurrenceEnd?: string | null) => {
      const useSingleOccurrence = Boolean(
        record.recurrenceRule &&
          !record.parentEventId &&
          occurrenceStart &&
          occurrenceStart !== record.startAt,
      );

      const startDate = useSingleOccurrence
        ? new Date(occurrenceStart as string)
        : new Date(record.startAt);
      const endDate = useSingleOccurrence
        ? new Date(occurrenceEnd ?? new Date(startDate.getTime() + 60 * 60 * 1000).toISOString())
        : new Date(record.endAt);

      const editor: EventEditorState = {
        id: record.id,
        scope: useSingleOccurrence ? "single" : "series",
        occurrenceStart: useSingleOccurrence ? (occurrenceStart as string) : null,
        calendarId: record.calendarId,
        title: record.title,
        allDay: record.allDay,
        startInput: toEditorStartInput(startDate, record.allDay),
        endInput: toEditorEndInput(endDate, record.allDay),
        location: record.location ?? "",
        description: record.description ?? "",
        notes: record.notes ?? "",
        color: record.color ?? "",
        eventType: record.eventType,
        workingLocationLabel: record.workingLocationLabel ?? "",
        timezone: record.timezone ?? displayTimezone,
        repeat: parseRepeatFromRule(record.recurrenceRule),
        reminders:
          record.reminders.length > 0
            ? record.reminders.map((reminder) => ({
                id: reminder.id,
                minutesBefore: reminder.minutesBefore,
                method: reminder.method,
              }))
            : [{ minutesBefore: 10, method: "inapp" }],
        tagsInput: tagsToInput(record.tags),
      };

      openEditor(editor);
    },
    [displayTimezone, openEditor],
  );

  const handleDateSelect = useCallback(
    (selection: DateSelectArg) => {
      const endDate = selection.allDay ? addDays(selection.end, -1) : selection.end;
      openQuickModal(selection.start, endDate, selection.allDay);
    },
    [openQuickModal],
  );

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const record = arg.event.extendedProps.record as EventRecord | undefined;
      if (!record) {
        return;
      }

      openEditorFromEvent(
        record,
        arg.event.start?.toISOString() ?? null,
        arg.event.end?.toISOString() ?? null,
      );
    },
    [openEditorFromEvent],
  );

  const syncCalendarMeta = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) {
      return;
    }

    setCalendarTitle(calendarApi.view.title);
    setCurrentView(calendarApi.view.type as CalendarViewKey);
    const currentDate = calendarApi.getDate();
    setFocusedDate(currentDate);
    setMiniMonthCursor(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  }, []);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRange({
      start: arg.start.toISOString(),
      end: arg.end.toISOString(),
    });
    setCalendarTitle(arg.view.title);
    setCurrentView(arg.view.type as CalendarViewKey);
    const currentDate = calendarRef.current?.getApi().getDate() ?? arg.start;
    setFocusedDate(currentDate);
    setMiniMonthCursor(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  }, []);

  const patchCalendarEventTime = useCallback(
    async (id: string, startAtIso: string, endAtIso: string) => {
      const response = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: startAtIso,
          endAt: endAtIso,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to update event timing.");
      }

      return (await response.json()) as EventRecord;
    },
    [],
  );

  const handleEventMoveOrResize = useCallback(
    async (arg: EventDropArg | EventResizeDoneArg) => {
      if (!arg.event.start) {
        arg.revert();
        return;
      }

      const startAt = arg.event.start;
      const endAt = arg.event.end ?? new Date(startAt.getTime() + 60 * 60 * 1000);

      try {
        await patchCalendarEventTime(arg.event.id, startAt.toISOString(), endAt.toISOString());
        await mutateEvents();
      } catch (error) {
        arg.revert();
        setActionError(error instanceof Error ? error.message : "Unable to move event.");
      }
    },
    [mutateEvents, patchCalendarEventTime],
  );

  const moveCalendar = useCallback(
    (direction: "prev" | "next" | "today") => {
      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) {
        return;
      }

      if (direction === "prev") {
        calendarApi.prev();
      } else if (direction === "next") {
        calendarApi.next();
      } else {
        calendarApi.today();
      }

      syncCalendarMeta();
    },
    [syncCalendarMeta],
  );

  const changeView = useCallback(
    (view: CalendarViewKey) => {
      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) {
        return;
      }

      calendarApi.changeView(view);
      syncCalendarMeta();
    },
    [syncCalendarMeta],
  );

  const toggleCalendarVisibility = useCallback((calendarId: string) => {
    setVisibleCalendarIds((current) => {
      if (current.includes(calendarId)) {
        return current.filter((item) => item !== calendarId);
      }
      return [...current, calendarId];
    });
  }, []);

  useEffect(() => {
    if (!activeCalendarId && calendars[0]) {
      setActiveCalendarId(calendars[0].id);
      return;
    }

    if (activeCalendarId && visibleCalendarIds.includes(activeCalendarId)) {
      return;
    }

    if (visibleCalendarIds.length > 0) {
      setActiveCalendarId(visibleCalendarIds[0]);
    }
  }, [activeCalendarId, calendars, visibleCalendarIds]);

  const handleCreateCalendar = useCallback(async () => {
    const name = newCalendarName.trim();
    if (!name) {
      setActionError("Calendar name is required.");
      return;
    }

    setCreatingCalendar(true);
    setActionError(null);

    const response = await fetch("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        color: newCalendarColor,
      }),
    });

    setCreatingCalendar(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setActionError(payload?.error ?? "Unable to create calendar.");
      return;
    }

    const created = (await response.json()) as CalendarRecord;
    setVisibleCalendarIds((current) => [...current, created.id]);
    setActiveCalendarId(created.id);
    setAddCalendarOpen(false);
    setNewCalendarName("");
    await mutateCalendars();
  }, [mutateCalendars, newCalendarColor, newCalendarName]);

  const handleQuickSave = useCallback(async () => {
    if (!quickDraft) {
      return;
    }

    const title = quickDraft.title.trim();
    if (!title) {
      setActionError("Event title is required.");
      return;
    }

    const startAt = parseEditorDate(quickDraft.startInput, quickDraft.allDay, false);
    const endAt = parseEditorDate(quickDraft.endInput, quickDraft.allDay, true);

    if (!startAt || !endAt || startAt >= endAt) {
      setActionError("Please provide a valid start and end time.");
      return;
    }

    setQuickSaving(true);
    setActionError(null);

    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        calendarId: quickDraft.calendarId || activeCalendarId,
        title,
        allDay: quickDraft.allDay,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      }),
    });

    setQuickSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setActionError(payload?.error ?? "Unable to create event.");
      return;
    }

    toast.success("Event created.");
    setQuickModalOpen(false);
    setQuickDraft(null);
    await mutateEvents();
  }, [activeCalendarId, mutateEvents, quickDraft]);

  const openMoreOptions = useCallback(() => {
    if (!quickDraft) {
      return;
    }

    const calendarColor = calendars.find((item) => item.id === quickDraft.calendarId)?.color;
    openEditor(
      buildEditorFromQuick({
        quick: quickDraft,
        timezone: displayTimezone,
        color: calendarColor,
      }),
    );
    setQuickModalOpen(false);
  }, [calendars, displayTimezone, openEditor, quickDraft]);

  const addReminderRow = useCallback(() => {
    setEditorState((current) => {
      if (!current) {
        return current;
      }

      const used = new Set(current.reminders.map((item) => item.minutesBefore));
      const fallbackMinutes = REMINDER_QUICK_VALUES.find((value) => !used.has(value)) ?? 15;

      return {
        ...current,
        reminders: [...current.reminders, { minutesBefore: fallbackMinutes, method: "inapp" }],
      };
    });
  }, []);

  const updateReminderRow = useCallback((index: number, updates: Partial<ReminderDraft>) => {
    setEditorState((current) => {
      if (!current) {
        return current;
      }

      const next = [...current.reminders];
      const target = next[index];
      if (!target) {
        return current;
      }

      next[index] = {
        ...target,
        ...updates,
      };

      return {
        ...current,
        reminders: next,
      };
    });
  }, []);

  const removeReminderRow = useCallback((index: number) => {
    setEditorState((current) => {
      if (!current) {
        return current;
      }

      if (current.reminders.length <= 1) {
        return {
          ...current,
          reminders: [{ minutesBefore: 10, method: "inapp" }],
        };
      }

      return {
        ...current,
        reminders: current.reminders.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }, []);

  const buildEventPayloadFromEditor = useCallback((editor: EventEditorState) => {
    const title = editor.title.trim();
    if (!title) {
      return { error: "Event title is required." as const };
    }

    const startAt = parseEditorDate(editor.startInput, editor.allDay, false);
    const endAt = parseEditorDate(editor.endInput, editor.allDay, true);

    if (!startAt || !endAt || startAt >= endAt) {
      return { error: "Please provide a valid start and end time." as const };
    }

    const recurrence = buildRepeatRule({
      repeat: editor.repeat,
      startAt,
      allDay: editor.allDay,
    });

    return {
      payload: {
        calendarId: editor.calendarId,
        title,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        allDay: editor.allDay,
        location: editor.location.trim() || null,
        description: editor.description.trim() || null,
        notes: editor.notes.trim() || null,
        color: editor.color.trim() || null,
        eventType: editor.eventType,
        workingLocationLabel:
          editor.eventType === "workingLocation"
            ? editor.workingLocationLabel.trim() || null
            : null,
        timezone: editor.timezone,
        recurrenceRule: recurrence.recurrenceRule,
        recurrenceUntil: recurrence.recurrenceUntil?.toISOString() ?? null,
        recurrenceCount: recurrence.recurrenceCount,
        reminders: editor.reminders
          .map((item) => ({
            minutesBefore: Math.max(0, Math.trunc(item.minutesBefore || 0)),
            method: item.method,
          }))
          .filter((item) => item.minutesBefore >= 0),
        tags: normalizeTags(editor.tagsInput),
      },
    };
  }, []);

  const handleSaveEditor = useCallback(async () => {
    if (!editorState) {
      return;
    }

    const parsed = buildEventPayloadFromEditor(editorState);
    if ("error" in parsed && parsed.error) {
      setActionError(parsed.error);
      return;
    }

    setEditorSaving(true);
    setActionError(null);

    const body =
      editorState.id && editorState.scope === "single" && editorState.occurrenceStart
        ? {
            ...parsed.payload,
            scope: "single",
            occurrenceStart: editorState.occurrenceStart,
          }
        : parsed.payload;

    const response = await fetch(editorState.id ? `/api/events/${editorState.id}` : "/api/events", {
      method: editorState.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setEditorSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setActionError(payload?.error ?? "Unable to save event.");
      return;
    }

    toast.success(editorState.id ? "Event updated." : "Event created.");
    setEditorOpen(false);
    setEditorState(null);
    await mutateEvents();
  }, [buildEventPayloadFromEditor, editorState, mutateEvents]);

  const handleDeleteEditor = useCallback(async () => {
    if (!editorState?.id) {
      return;
    }

    const confirmed = window.confirm(
      editorState.scope === "single"
        ? "Delete this occurrence?"
        : "Delete this event or series?",
    );

    if (!confirmed) {
      return;
    }

    const searchParams = new URLSearchParams();
    if (editorState.scope === "single" && editorState.occurrenceStart) {
      searchParams.set("scope", "single");
      searchParams.set("occurrenceStart", editorState.occurrenceStart);
    }

    const response = await fetch(
      `/api/events/${editorState.id}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setActionError(payload?.error ?? "Unable to delete event.");
      return;
    }

    toast.success("Event deleted.");
    setEditorOpen(false);
    setEditorState(null);
    await mutateEvents();
  }, [editorState, mutateEvents]);

  const handleDuplicateEditor = useCallback(() => {
    setEditorState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        id: null,
        scope: "series",
        occurrenceStart: null,
        title: `${current.title} (Copy)`,
      };
    });
  }, []);

  const searchCalendarParam = useMemo(() => visibleCalendarIds.join(","), [visibleCalendarIds]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (searchCalendarParam) {
          params.set("calendarIds", searchCalendarParam);
        }

        const response = await fetch(`/api/events/search?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { results: SearchResult[] };
        setSearchResults(payload.results);
        setSearchOpen(true);
      } catch {
        // Ignore aborted request.
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchCalendarParam, searchQuery]);

  const jumpToSearchResult = useCallback((item: SearchResult) => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) {
      return;
    }

    calendarApi.gotoDate(item.startAt);
    setSearchQuery(item.title);
    setSearchOpen(false);
    setHighlightedEventId(item.id);

    window.setTimeout(() => {
      setHighlightedEventId((current) => (current === item.id ? null : current));
    }, 3600);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "t" && !isTypingTarget(event.target)) {
        event.preventDefault();
        moveCalendar("today");
        return;
      }

      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (event.key === "Escape") {
        setQuickModalOpen(false);
        setEditorOpen(false);
        setSearchOpen(false);
        setAddCalendarOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveCalendar]);

  useEffect(() => {
    if (!editorOpen || !drawerRef.current) {
      return;
    }

    const container = drawerRef.current;
    const focusables = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    focusables[0]?.focus();

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const nodes = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

      if (nodes.length === 0) {
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", trapFocus);
    return () => window.removeEventListener("keydown", trapFocus);
  }, [editorOpen]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch("/api/events/reminders?windowMinutes=240");
        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as {
          now: string;
          reminders: Array<{
            id: string;
            eventId: string;
            eventTitle: string;
            reminderAt: string;
            eventStartAt: string;
            minutesBefore: number;
          }>;
        };

        const now = Date.now();

        for (const reminder of payload.reminders) {
          if (firedReminderIdsRef.current.has(reminder.id)) {
            continue;
          }

          const dueAt = new Date(reminder.reminderAt).getTime();
          if (dueAt > now) {
            continue;
          }

          firedReminderIdsRef.current.add(reminder.id);
          toast(`Reminder: ${reminder.eventTitle}`);
          await fetch(`/api/events/reminders/${reminder.id}/fire`, { method: "POST" });
        }
      } catch {
        // Ignore reminder polling errors.
      }
    };

    void run();
    const interval = window.setInterval(run, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleExportCalendar = useCallback(async () => {
    const exportCalendarId = activeCalendarId || visibleCalendarIds[0] || calendars[0]?.id;
    if (!exportCalendarId) {
      setActionError("No calendar available to export.");
      return;
    }

    const response = await fetch(`/api/calendars/${exportCalendarId}/export`);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setActionError(payload?.error ?? "Unable to export calendar.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "calendar.ics";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [activeCalendarId, calendars, visibleCalendarIds]);

  const handleImportFile = useCallback(
    async (file: File) => {
      const targetCalendarId = activeCalendarId || visibleCalendarIds[0] || calendars[0]?.id;
      if (!targetCalendarId) {
        setActionError("Select a calendar before importing.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("calendarId", targetCalendarId);

      const response = await fetch("/api/calendars/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setActionError(payload?.error ?? "Unable to import calendar file.");
        return;
      }

      const payload = (await response.json()) as { importedCount: number; skippedCount: number };
      toast.success(`Imported ${payload.importedCount} events.`);
      await mutateEvents();
    },
    [activeCalendarId, calendars, mutateEvents, visibleCalendarIds],
  );

  const renderEventContent = useCallback((arg: EventContentArg) => {
    const record = arg.event.extendedProps.record as EventRecord | undefined;

    return (
      <div className="flex min-w-0 items-center gap-1.5">
        {record?.eventType === "focus" ? <Bell className="h-3 w-3 shrink-0" /> : null}
        {record?.eventType === "workingLocation" ? <MapPin className="h-3 w-3 shrink-0" /> : null}
        <span className="truncate text-xs font-medium">{arg.event.title}</span>
      </div>
    );
  }, []);

  const miniGridDays = useMemo(() => buildMiniMonthGrid(miniMonthCursor), [miniMonthCursor]);

  return (
    <section className="relative h-[calc(100vh-94px)] min-h-[700px] overflow-hidden rounded-2xl border border-zinc-900/80 bg-[#060607]/90">
      <div className="grid h-full grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden h-full border-r border-zinc-900/80 bg-zinc-950/35 md:flex md:flex-col">
          <div className="border-b border-zinc-900/70 p-3">
            <Button
              variant="primary"
              className="w-full justify-start"
              onClick={() => {
                const calendarId = activeCalendarId || calendars[0]?.id || "";
                setQuickDraft(defaultQuickState(calendarId));
                setQuickModalOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </div>

          <div className="space-y-4 overflow-y-auto p-3">
            <Card className="border-zinc-800/80 bg-zinc-950/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Mini month</CardTitle>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Previous month"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:text-zinc-100"
                      onClick={() =>
                        setMiniMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next month"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:text-zinc-100"
                      onClick={() =>
                        setMiniMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-zinc-400">
                  {miniMonthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                  {WEEKDAY_LABELS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {miniGridDays.map((day) => {
                    const inMonth = day.getMonth() === miniMonthCursor.getMonth();
                    const isToday = isSameDay(day, new Date());
                    const isFocused = isSameDay(day, focusedDate);

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs transition",
                          inMonth ? "text-zinc-200" : "text-zinc-600",
                          isToday ? "border border-zinc-700 bg-zinc-900/70" : "",
                          isFocused ? "bg-zinc-100 text-zinc-900" : "hover:bg-zinc-900/70",
                        )}
                        onClick={() => {
                          const api = calendarRef.current?.getApi();
                          api?.gotoDate(day);
                          syncCalendarMeta();
                        }}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800/80 bg-zinc-950/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">My calendars</CardTitle>
                  <button
                    type="button"
                    aria-label="Add calendar"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:text-zinc-100"
                    onClick={() => setAddCalendarOpen((value) => !value)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {calendarsLoading && calendars.length === 0 ? (
                  <p className="text-sm text-zinc-400">Loading calendars...</p>
                ) : (
                  <ul className="space-y-1.5">
                    {calendars.map((calendar) => {
                      const checked = visibleCalendarIds.includes(calendar.id);
                      return (
                        <li key={calendar.id}>
                          <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900/70">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCalendarVisibility(calendar.id)}
                              className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
                            />
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: calendar.color }}
                              aria-hidden
                            />
                            <span className="truncate">{calendar.name}</span>
                            <button
                              type="button"
                              className={cn(
                                "ml-auto rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em]",
                                activeCalendarId === calendar.id
                                  ? "border-zinc-700 bg-zinc-800 text-zinc-200"
                                  : "border-zinc-800 text-zinc-500 hover:text-zinc-300",
                              )}
                              onClick={(event) => {
                                event.preventDefault();
                                setActiveCalendarId(calendar.id);
                              }}
                            >
                              Use
                            </button>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {addCalendarOpen && (
                  <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5">
                    <Input
                      value={newCalendarName}
                      onChange={(event) => setNewCalendarName(event.target.value)}
                      placeholder="Calendar name"
                      className="h-9"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {CALENDAR_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Select ${color}`}
                          className={cn(
                            "h-6 w-6 rounded-full border",
                            newCalendarColor === color ? "border-zinc-100" : "border-zinc-700",
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewCalendarColor(color)}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => void handleCreateCalendar()}
                        disabled={isCreatingCalendar}
                      >
                        {isCreatingCalendar ? "Adding..." : "Add"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAddCalendarOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <Separator className="bg-zinc-900/70" />

                <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => void handleExportCalendar()}>
                  <Download className="mr-2 h-4 w-4" />
                  Export (.ics)
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import (.ics)
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ics,text/calendar"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (file) {
                      void handleImportFile(file);
                    }
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </aside>

        <div className="flex min-h-0 flex-col">
          <div className="border-b border-zinc-900/80 px-4 py-3 md:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-xl border border-zinc-800 bg-zinc-900/70 p-1">
                <button
                  type="button"
                  onClick={() => moveCalendar("today")}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                >
                  Today
                </button>
                <button
                  type="button"
                  aria-label="Previous"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800"
                  onClick={() => moveCalendar("prev")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800"
                  onClick={() => moveCalendar("next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="min-w-[180px] text-sm font-semibold text-zinc-100">{calendarTitle}</div>

              <div className="relative ml-auto w-full max-w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setSearchOpen(searchResults.length > 0)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
                  placeholder="Search events"
                  className="h-9 border-zinc-800 bg-zinc-950/80 pl-9"
                />
                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute top-[calc(100%+6px)] z-20 w-full rounded-xl border border-zinc-800 bg-zinc-950/95 p-1 shadow-xl">
                    {searchResults.map((item) => (
                      <button
                        key={`${item.id}-${item.startAt}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => jumpToSearchResult(item)}
                        className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-zinc-900/80"
                      >
                        <p className="truncate text-sm text-zinc-100">{item.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{formatDateTimeLabel(item.startAt)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="inline-flex items-center rounded-xl border border-zinc-800 bg-zinc-900/70 p-1">
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => changeView(option.key)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium",
                      currentView === option.key
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-300 hover:bg-zinc-800",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Shortcuts: <kbd className="rounded bg-zinc-900 px-1">t</kbd>, <kbd className="rounded bg-zinc-900 px-1">/</kbd>, <kbd className="rounded bg-zinc-900 px-1">esc</kbd>
            </p>
          </div>

          {resultsError && (
            <p className="mx-4 mt-3 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-300 md:mx-5">
              {resultsError}
            </p>
          )}

          <div className="min-h-0 flex-1 p-4 md:p-5">
            <Card className="h-full overflow-hidden border-zinc-900/80 bg-zinc-950/30">
              <CardContent className="h-full p-2 md:p-3">
                {eventsLoading && events.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading events...
                  </div>
                ) : (
                  <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, rrulePlugin]}
                    initialView="dayGridMonth"
                    selectable
                    selectMirror
                    editable
                    eventResizableFromStart
                    nowIndicator
                    dayMaxEvents={3}
                    fixedWeekCount={false}
                    height="100%"
                    headerToolbar={false}
                    timeZone="local"
                    events={mappedEvents}
                    select={handleDateSelect}
                    eventClick={handleEventClick}
                    eventDrop={handleEventMoveOrResize}
                    eventResize={handleEventMoveOrResize}
                    datesSet={handleDatesSet}
                    eventContent={renderEventContent}
                    eventClassNames={(arg) => {
                      const record = arg.event.extendedProps.record as EventRecord | undefined;
                      const classes: string[] = [];
                      if (arg.event.id === highlightedEventId) {
                        classes.push("blackdesk-event-highlight");
                      }
                      if (record?.eventType === "focus") {
                        classes.push("blackdesk-event-focus");
                      }
                      if (record?.eventType === "outOfOffice") {
                        classes.push("blackdesk-event-ooo");
                      }
                      if (record?.eventType === "workingLocation") {
                        classes.push("blackdesk-event-location");
                      }
                      return classes;
                    }}
                    buttonText={{ listWeek: "Schedule" }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Modal
        title="Quick event"
        open={quickModalOpen}
        onClose={() => setQuickModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setQuickModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={openMoreOptions}>
              More options
            </Button>
            <Button variant="primary" onClick={() => void handleQuickSave()} disabled={isQuickSaving}>
              {isQuickSaving ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        {quickDraft && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleQuickSave();
            }}
          >
            <div>
              <label htmlFor="quick-title" className="mb-1 block text-sm text-zinc-400">
                Title
              </label>
              <Input
                id="quick-title"
                value={quickDraft.title}
                onChange={(event) =>
                  setQuickDraft((current) =>
                    current ? { ...current, title: event.target.value } : current,
                  )
                }
                placeholder="Add title"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="quick-all-day"
                type="checkbox"
                checked={quickDraft.allDay}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setQuickDraft((current) => {
                    if (!current) {
                      return current;
                    }
                    const nextStart = parseEditorDate(current.startInput, current.allDay, false) ?? new Date();
                    const nextEnd = parseEditorDate(current.endInput, current.allDay, true) ?? addDays(nextStart, 1);
                    return {
                      ...current,
                      allDay: checked,
                      startInput: toEditorStartInput(nextStart, checked),
                      endInput: toEditorEndInput(nextEnd, checked),
                    };
                  });
                }}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
              />
              <label htmlFor="quick-all-day" className="text-sm text-zinc-300">
                All day
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="quick-start" className="mb-1 block text-sm text-zinc-400">
                  Start
                </label>
                <Input
                  id="quick-start"
                  type={quickDraft.allDay ? "date" : "datetime-local"}
                  value={quickDraft.startInput}
                  onChange={(event) =>
                    setQuickDraft((current) =>
                      current ? { ...current, startInput: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div>
                <label htmlFor="quick-end" className="mb-1 block text-sm text-zinc-400">
                  End
                </label>
                <Input
                  id="quick-end"
                  type={quickDraft.allDay ? "date" : "datetime-local"}
                  value={quickDraft.endInput}
                  onChange={(event) =>
                    setQuickDraft((current) =>
                      current ? { ...current, endInput: event.target.value } : current,
                    )
                  }
                />
              </div>
            </div>
          </form>
        )}
      </Modal>

      {editorOpen && editorState && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[1px]"
            onClick={() => setEditorOpen(false)}
            aria-label="Close editor"
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Event details"
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-xl flex-col border-l border-zinc-800 bg-[#0b0b0d] shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-zinc-900/80 px-4 py-3">
              <CalendarPlus className="h-4 w-4 text-zinc-400" />
              <p className="text-sm font-semibold text-zinc-100">
                {editorState.id ? "Event details" : "Create event"}
              </p>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:text-zinc-100"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <label htmlFor="editor-title" className="mb-1 block text-sm text-zinc-400">
                  Title
                </label>
                <Input
                  id="editor-title"
                  value={editorState.title}
                  onChange={(event) =>
                    setEditorState((current) =>
                      current ? { ...current, title: event.target.value } : current,
                    )
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="editor-calendar" className="mb-1 block text-sm text-zinc-400">
                    Calendar
                  </label>
                  <select
                    id="editor-calendar"
                    value={editorState.calendarId}
                    onChange={(event) =>
                      setEditorState((current) =>
                        current ? { ...current, calendarId: event.target.value } : current,
                      )
                    }
                    className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 text-sm text-zinc-100"
                  >
                    {calendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="editor-type" className="mb-1 block text-sm text-zinc-400">
                    Event type
                  </label>
                  <select
                    id="editor-type"
                    value={editorState.eventType}
                    onChange={(event) =>
                      setEditorState((current) =>
                        current
                          ? {
                              ...current,
                              eventType: event.target.value as EventEditorState["eventType"],
                            }
                          : current,
                      )
                    }
                    className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 text-sm text-zinc-100"
                  >
                    {EVENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="editor-start" className="mb-1 block text-sm text-zinc-400">
                    Start
                  </label>
                  <Input
                    id="editor-start"
                    type={editorState.allDay ? "date" : "datetime-local"}
                    value={editorState.startInput}
                    onChange={(event) =>
                      setEditorState((current) =>
                        current ? { ...current, startInput: event.target.value } : current,
                      )
                    }
                  />
                </div>
                <div>
                  <label htmlFor="editor-end" className="mb-1 block text-sm text-zinc-400">
                    End
                  </label>
                  <Input
                    id="editor-end"
                    type={editorState.allDay ? "date" : "datetime-local"}
                    value={editorState.endInput}
                    onChange={(event) =>
                      setEditorState((current) =>
                        current ? { ...current, endInput: event.target.value } : current,
                      )
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="editor-all-day"
                  type="checkbox"
                  checked={editorState.allDay}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setEditorState((current) => {
                      if (!current) {
                        return current;
                      }
                      const currentStart = parseEditorDate(current.startInput, current.allDay, false) ?? new Date();
                      const currentEnd = parseEditorDate(current.endInput, current.allDay, true) ?? addDays(currentStart, 1);
                      return {
                        ...current,
                        allDay: checked,
                        startInput: toEditorStartInput(currentStart, checked),
                        endInput: toEditorEndInput(currentEnd, checked),
                      };
                    });
                  }}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
                />
                <label htmlFor="editor-all-day" className="text-sm text-zinc-300">
                  All day
                </label>
              </div>

              <p className="text-xs text-zinc-500">Timezone: {editorState.timezone || displayTimezone}</p>

              <div>
                <label htmlFor="editor-repeat" className="mb-1 block text-sm text-zinc-400">
                  Repeat
                </label>
                <select
                  id="editor-repeat"
                  value={editorState.repeat.preset}
                  onChange={(event) =>
                    setEditorState((current) =>
                      current
                        ? {
                            ...current,
                            repeat: { ...current.repeat, preset: event.target.value as RepeatPreset },
                          }
                        : current,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 text-sm text-zinc-100"
                >
                  {REPEAT_PRESET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="editor-location" className="mb-1 block text-sm text-zinc-400">
                  Location
                </label>
                <Input
                  id="editor-location"
                  value={editorState.location}
                  onChange={(event) =>
                    setEditorState((current) =>
                      current ? { ...current, location: event.target.value } : current,
                    )
                  }
                />
              </div>

              <div>
                <label htmlFor="editor-description" className="mb-1 block text-sm text-zinc-400">
                  Description
                </label>
                <textarea
                  id="editor-description"
                  rows={3}
                  value={editorState.description}
                  onChange={(event) =>
                    setEditorState((current) =>
                      current ? { ...current, description: event.target.value } : current,
                    )
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100"
                />
              </div>

              <div>
                <label htmlFor="editor-tags" className="mb-1 block text-sm text-zinc-400">
                  Tags
                </label>
                <Input
                  id="editor-tags"
                  value={editorState.tagsInput}
                  onChange={(event) =>
                    setEditorState((current) =>
                      current ? { ...current, tagsInput: event.target.value } : current,
                    )
                  }
                  placeholder="work, health, travel"
                />
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-200">Reminders</p>
                  <Button size="sm" variant="outline" onClick={addReminderRow}>
                    Add reminder
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {editorState.reminders.map((reminder, index) => (
                    <div key={`${reminder.id ?? "draft"}-${index}`} className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        value={reminder.minutesBefore}
                        onChange={(event) =>
                          updateReminderRow(index, {
                            minutesBefore: Math.max(0, Number(event.target.value) || 0),
                          })
                        }
                        className="h-9 w-24"
                      />
                      <span className="text-xs text-zinc-500">minutes before</span>
                      <button
                        type="button"
                        onClick={() => removeReminderRow(index)}
                        className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-400 transition hover:text-zinc-200"
                        aria-label="Remove reminder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-900/80 px-4 py-3">
              {editorState.id && (
                <Button variant="danger" onClick={() => void handleDeleteEditor()}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button variant="outline" onClick={handleDuplicateEditor}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" onClick={() => setEditorOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => void handleSaveEditor()} disabled={isEditorSaving}>
                  {isEditorSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </aside>
        </>
      )}
    </section>
  );
}

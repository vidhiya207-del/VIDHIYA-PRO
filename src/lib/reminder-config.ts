export const REMINDER_TYPES = [
  "Daily Study Reminder",
  "Revision Reminder",
  "Assignment Reminder",
  "Exam Reminder",
  "Attendance Reminder",
  "Mock Test Reminder",
  "Interview Reminder",
  "Placement Reminder",
  "Deadline Reminder",
  "Motivation Reminder",
  "Water Break Reminder",
  "Study Session Reminder",
  "Custom Reminder",
] as const;

export const REPEAT_RULES = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays only (Mon–Fri)" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom days" },
] as const;

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export const METHODS = [
  { value: "push", label: "Browser / Mobile Push" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
] as const;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo",
  "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "UTC",
];

export interface Reminder {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  subject: string | null;
  topic: string | null;
  reminder_type: string;
  repeat_rule: string;
  repeat_days: number[];
  timezone: string;
  methods: string[];
  priority: string | null;
  due_date: string | null;
  is_completed: boolean;
  is_paused: boolean;
  is_archived: boolean;
  last_sent_at: string | null;
  sent_count: number;
}

export function priorityClass(p: string | null) {
  switch (p) {
    case "high":
    case "urgent":
      return "bg-destructive/20 text-destructive";
    case "medium":
    case "normal":
      return "bg-primary/20 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function describeSchedule(r: Reminder) {
  const when = r.due_date
    ? new Date(r.due_date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "No date set";
  const repeat = REPEAT_RULES.find((x) => x.value === r.repeat_rule)?.label ?? "Does not repeat";
  if (r.repeat_rule === "custom") {
    const days = r.repeat_days.map((d) => WEEKDAYS[d]).join(", ") || "no days";
    return `${when} · repeats ${days}`;
  }
  return r.repeat_rule === "none" ? when : `${when} · ${repeat}`;
}

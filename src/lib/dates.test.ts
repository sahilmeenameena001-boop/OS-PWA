import { describe, expect, it } from "vitest";
import { budgetPeriod, combineDateTime, fromDateKey, isoInDay, toDateKey } from "@/lib/dates";
import { itemsForDay } from "@/lib/schedule/day";
import type { CalendarEvent, Task } from "@/lib/types";

describe("date boundaries", () => {
  it("keeps local calendar dates stable across midnight (no UTC shift)", () => {
    const lateNight = new Date(2026, 8, 6, 23, 59, 30);
    expect(toDateKey(lateNight)).toBe("2026-09-06");
    const earlyMorning = new Date(2026, 8, 7, 0, 0, 10);
    expect(toDateKey(earlyMorning)).toBe("2026-09-07");
    expect(toDateKey(fromDateKey("2026-02-28"))).toBe("2026-02-28");
  });
  it("matches ISO timestamps to local day keys", () => {
    const iso = new Date(2026, 8, 6, 23, 30).toISOString();
    expect(isoInDay(iso, "2026-09-06")).toBe(true);
    expect(isoInDay(iso, "2026-09-07")).toBe(false);
  });
  it("budget period anchors on income day and counts remaining days inclusively", () => {
    expect(budgetPeriod(1, new Date(2026, 8, 15))).toEqual({ start: "2026-09-01", end: "2026-09-30", remainingDays: 16, totalDays: 30 });
    expect(budgetPeriod(25, new Date(2026, 8, 10))).toMatchObject({ start: "2026-08-25", end: "2026-09-24", remainingDays: 15 });
    expect(budgetPeriod(31, new Date(2026, 1, 10)).start).toBe("2026-01-28");
  });
  it("combines a date key with HH:MM in local time", () => {
    const d = combineDateTime("2026-09-06", "09:30");
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
    expect(toDateKey(d)).toBe("2026-09-06");
  });
  it("places recurring items on the requested day at their original time", () => {
    const ev: CalendarEvent = { id: "e", user_id: "u", created_at: "", updated_at: "", title: "Standup", description: null, start_at: new Date(2026, 8, 1, 9, 30).toISOString(), end_at: new Date(2026, 8, 1, 9, 45).toISOString(), all_day: false, location: null, category: null, recurrence: { frequency: "weekdays" }, reminder_offsets: [], status: "scheduled", source_inbox_id: null };
    const task: Task = { id: "t", user_id: "u", created_at: "", updated_at: "", title: "Late", description: null, status: "todo", priority: 3, category: null, due_on: "2026-09-08", scheduled_start: new Date(2026, 8, 8, 23, 45).toISOString(), scheduled_end: null, completed_at: null, recurrence: null, reminder_offsets: [], routine_id: null, is_top_priority: false, sort_order: 0, source_inbox_id: null };
    const items = itemsForDay("2026-09-08", [task], [ev]);
    expect(items.map((i) => i.title)).toEqual(["Standup", "Late"]);
    expect(items[0].start?.getHours()).toBe(9);
    expect(toDateKey(items[0].start!)).toBe("2026-09-08");
    expect(itemsForDay("2026-09-06", [], [ev])).toHaveLength(0); // Saturday
  });
});

import { describe, expect, it } from "vitest";
import { advanceDue, nextOccurrence, occurrencesBetween, occursOn } from "@/lib/schedule/recurrence";

describe("recurrence", () => {
  it("daily with interval", () => {
    expect(occursOn({ frequency: "daily", interval: 2 }, "2026-09-01", "2026-09-03")).toBe(true);
    expect(occursOn({ frequency: "daily", interval: 2 }, "2026-09-01", "2026-09-04")).toBe(false);
    expect(occursOn({ frequency: "daily" }, "2026-09-05", "2026-09-04")).toBe(false);
  });
  it("weekdays only", () => {
    // 2026-09-05 is a Saturday, 2026-09-07 a Monday
    expect(occursOn({ frequency: "weekdays" }, "2026-09-01", "2026-09-05")).toBe(false);
    expect(occursOn({ frequency: "weekdays" }, "2026-09-01", "2026-09-07")).toBe(true);
  });
  it("weekly on chosen days with until", () => {
    const rec = { frequency: "weekly" as const, days: [1, 3], until: "2026-09-20" };
    expect(occurrencesBetween(rec, "2026-09-01", "2026-09-01", "2026-09-30")).toEqual(["2026-09-02", "2026-09-07", "2026-09-09", "2026-09-14", "2026-09-16"]);
  });
  it("weekly with 2-week interval anchored on first occurrence", () => {
    const rec = { frequency: "weekly" as const, interval: 2, days: [1] };
    expect(occurrencesBetween(rec, "2026-09-07", "2026-09-01", "2026-10-05")).toEqual(["2026-09-07", "2026-09-21", "2026-10-05"]);
  });
  it("custom days and next occurrence", () => {
    expect(nextOccurrence({ frequency: "custom", days: [0] }, "2026-09-01", "2026-09-07")).toBe("2026-09-13");
    expect(nextOccurrence(null, "2026-09-10", "2026-09-07")).toBe("2026-09-10");
    expect(nextOccurrence(null, "2026-09-01", "2026-09-07")).toBeNull();
  });
  it("advances due dates without month overflow", () => {
    expect(advanceDue("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(advanceDue("2026-03-31", "monthly")).toBe("2026-04-30");
    expect(advanceDue("2024-02-29", "yearly")).toBe("2025-02-28");
    expect(advanceDue("2026-09-01", "weekly")).toBe("2026-09-08");
    expect(advanceDue("2026-09-01", "once")).toBe("2026-09-01");
  });
});

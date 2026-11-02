import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysISO, daysUntil, formatDueLabel, todayISO } from "@/lib/taskDates";
import { isTaskDueSoon, isTaskOverdue } from "@/lib/mockData";
import type { Task } from "@/lib/types";

const task = (endDate?: string, status: Task["status"] = "pending"): Task => ({
  id: "t1",
  name: "Tarefa",
  projectId: "p1",
  status,
  priority: "medium",
  endDate,
  updatedAt: "2026-11-01T00:00:00Z",
});

describe("taskDates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 09:00 local de 02/11/2026 (já é dia 02 em UTC e em BRT)
    vi.setSystemTime(new Date(2026, 10, 2, 9, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("usa a data local", () => {
    expect(todayISO()).toBe("2026-11-02");
    expect(addDaysISO("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("calcula dias até o prazo", () => {
    expect(daysUntil("2026-11-02")).toBe(0);
    expect(daysUntil("2026-11-01")).toBe(-1);
    expect(daysUntil("2026-11-09")).toBe(7);
    expect(daysUntil(undefined)).toBeNull();
  });

  it("não marca como atrasada a tarefa que vence hoje", () => {
    expect(isTaskOverdue(task("2026-11-02"))).toBe(false);
    expect(isTaskDueSoon(task("2026-11-02"))).toBe(true);
    expect(isTaskOverdue(task("2026-11-01"))).toBe(true);
    expect(isTaskOverdue(task("2026-11-01", "completed"))).toBe(false);
  });

  it("formata o rótulo do prazo", () => {
    expect(formatDueLabel(0)).toBe("Hoje");
    expect(formatDueLabel(-3)).toBe("3 dias atrás");
    expect(formatDueLabel(null)).toBe("Sem prazo");
  });
});

import type { Classification, DailySummary } from "@/lib/types";

/**
 * AIAdapter is the seam for future summarisation/classification providers.
 * V1 ships only the disabled mock; all summaries are deterministic (see memory/summary.ts).
 */
export interface AIAdapter {
  readonly enabled: boolean;
  readonly name: string;
  suggestClassification(text: string): Promise<Classification | null>;
  summarizeDay(summary: DailySummary, date: string): Promise<string | null>;
}

export const disabledAIAdapter: AIAdapter = {
  enabled: false,
  name: "disabled",
  async suggestClassification() {
    return null;
  },
  async summarizeDay() {
    return null;
  },
};

export function getAIAdapter(): AIAdapter {
  return disabledAIAdapter;
}

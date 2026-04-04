import { sampleEvaluations } from "@/lib/audit-demo-data";
import type { SampleEvaluation } from "@/types/audit";

// Returns the mock sample evaluations (stub for real LLM judge).
// Sorted by score descending so the UI displays best first.
export function scoreSamples(): SampleEvaluation[] {
  return [...sampleEvaluations].sort((a, b) => b.score - a.score);
}

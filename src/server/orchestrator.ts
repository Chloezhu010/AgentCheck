import { normalizeWeights, buildDeliveryReport } from "@/lib/audit-demo-data";
import { recordAuditEvent } from "@/server/audit-log";
import { generateAllSamples, llmJudgeScore } from "@/server/judge";
import {
  getVisibleBids,
  getCountdownSeconds,
  isBiddingComplete,
} from "@/server/mock-market";
import type {
  AuditEvent,
  AuditSession,
  IntentInput,
  OrchestratorMessage,
  SampleEvaluation,
} from "@/types/audit";

// In-memory store — sufficient for the demo prototype.
type SessionEntry = AuditSession & {
  startedAt: number;
  imageGenStarted?: boolean;
  judgeStarted?: boolean;
  seenBidCount: number;
};
const sessions = new Map<string, SessionEntry>();

function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function msgId(): string {
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function makeMsg(
  text: string,
  kind: "text" | "scoreCanvas" = "text",
  samples?: SampleEvaluation[],
): OrchestratorMessage {
  return { id: msgId(), ts: Date.now(), text, kind, samples };
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

// Fire-and-forget HCS logging — appends audit event to session when done
function logHcs(
  sessionId: string,
  taskId: string,
  eventType: Parameters<typeof recordAuditEvent>[1],
  label: string,
  data: Record<string, unknown> = {},
  agentId?: string,
) {
  recordAuditEvent(taskId, eventType, label, data, agentId).then((event) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    session.auditTrail = [...session.auditTrail, event];
    session.updatedAt = Date.now();
  });
}

// Advance the session state based on elapsed time.
function advance(session: SessionEntry): AuditSession {
  if (session.state.stage !== "bidding") {
    return toPublic(session);
  }

  if (!isBiddingComplete(session.startedAt)) {
    // Still in bidding window — update visible bids and countdown.
    const visibleBids = getVisibleBids(session.startedAt);

    // Add messages for new bids
    for (let i = session.seenBidCount; i < visibleBids.length; i++) {
      const bid = visibleBids[i];
      session.messages.push(
        makeMsg(
          `Bid from **${bid.agentName}** (${bid.model}) — trial ${formatUsd(bid.trialQuoteUsd)} · full ${formatUsd(bid.quoteUsd)}, ETA ${bid.etaMinutes}min, rep ${bid.reputation.toFixed(2)}`,
        ),
      );
      logHcs(session.id, session.id, "BID_RECEIVED", `Bid: ${bid.agentName}`, {
        agentName: bid.agentName,
        quoteUsd: bid.quoteUsd,
      }, bid.id);
    }
    session.seenBidCount = visibleBids.length;

    session.state = {
      stage: "bidding",
      visibleBids,
      countdownSeconds: getCountdownSeconds(session.startedAt),
    };
    session.updatedAt = Date.now();
    return toPublic(session);
  }

  // Bidding window closed — transition to evaluating
  const allBids = getVisibleBids(session.startedAt);

  // Add remaining bid messages
  for (let i = session.seenBidCount; i < allBids.length; i++) {
    const bid = allBids[i];
    session.messages.push(
      makeMsg(
        `Bid from **${bid.agentName}** (${bid.model}) — trial ${formatUsd(bid.trialQuoteUsd)} · full ${formatUsd(bid.quoteUsd)}, ETA ${bid.etaMinutes}min, rep ${bid.reputation.toFixed(2)}`,
      ),
    );
  }
  session.seenBidCount = allBids.length;

  session.messages.push(
    makeMsg("Auction closed. Generating samples from all agents..."),
  );

  const scoreCanvasMsg = makeMsg("", "scoreCanvas", []);
  session.messages.push(scoreCanvasMsg);

  session.state = {
    stage: "evaluating",
    bids: allBids,
    samples: [],
  };
  session.updatedAt = Date.now();

  logHcs(session.id, session.id, "SAMPLE_REQUESTED", "Requesting samples from all agents", {
    agentCount: allBids.length,
  });

  // Fire-and-forget: generate real images, then run LLM judge
  if (!session.imageGenStarted) {
    session.imageGenStarted = true;
    const weights = normalizeWeights(session.input.weights);

    generateAllSamples(session.input.taskDescription)
      .then((samples) => {
        const current = sessions.get(session.id);
        if (!current || current.state.stage !== "evaluating") return;

        // Update scoreCanvas with images (scores still 0)
        updateScoreCanvas(current, scoreCanvasMsg.id, samples);

        // Now run LLM judge scoring
        if (!current.judgeStarted) {
          current.judgeStarted = true;
          current.messages.push(makeMsg("Samples received. LLM Judge is scoring..."));

          llmJudgeScore(samples, current.input.taskDescription, weights)
            .then((scored) => {
              const s = sessions.get(session.id);
              if (!s || s.state.stage !== "evaluating") return;

              updateScoreCanvas(s, scoreCanvasMsg.id, scored);
              (s.state as { samples: SampleEvaluation[] }).samples = scored;

              const best = scored[0];
              if (best) {
                s.messages.push(
                  makeMsg(
                    `Scoring complete. **${best.agentName}** leads with ${Math.round(best.score * 100)}/100. Select an agent to proceed.`,
                  ),
                );
                logHcs(s.id, s.id, "SAMPLE_SCORED", `Judge scored — ${best.agentName} leads`, {
                  scores: scored.map((x) => ({ id: x.agentId, score: x.score })),
                });
              }
              s.updatedAt = Date.now();
            })
            .catch(() => {
              // If judge fails, keep samples without scores
            });
        }
      })
      .catch(() => {
        // If image gen fails entirely, add error message
        const current = sessions.get(session.id);
        if (current) {
          current.messages.push(makeMsg("Image generation failed. You can still approve an agent based on bids."));
        }
      });
  }

  return toPublic(session);
}

function updateScoreCanvas(
  session: SessionEntry,
  canvasMsgId: string,
  samples: SampleEvaluation[],
) {
  session.messages = session.messages.map((m) =>
    m.id === canvasMsgId ? { ...m, samples } : m,
  );
  if (session.state.stage === "evaluating") {
    (session.state as { samples: SampleEvaluation[] }).samples = samples;
  }
  session.updatedAt = Date.now();
}

function toPublic(entry: SessionEntry): AuditSession {
  return {
    id: entry.id,
    input: entry.input,
    state: entry.state,
    messages: entry.messages,
    auditTrail: entry.auditTrail,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function createSession(input: IntentInput): AuditSession {
  const id = generateId();
  const now = Date.now();
  const weights = normalizeWeights(input.weights);
  const wp = {
    quality: Math.round(weights.quality * 100),
    price: Math.round(weights.price * 100),
    speed: Math.round(weights.speed * 100),
  };

  const messages: OrchestratorMessage[] = [
    makeMsg(`Budget set to **${formatUsd(input.budgetUsd)}**.`),
    makeMsg(
      `Opening RFQ for 15s — weights: quality ${wp.quality}%, price ${wp.price}%, speed ${wp.speed}%.`,
    ),
    makeMsg("Waiting for agent bids..."),
  ];

  const session: SessionEntry = {
    id,
    input,
    state: {
      stage: "bidding",
      visibleBids: [],
      countdownSeconds: 15,
    },
    messages,
    auditTrail: [],
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    seenBidCount: 0,
  };
  sessions.set(id, session);

  logHcs(id, id, "TASK_INTENT", "Task intent logged", {
    taskDescription: input.taskDescription,
    budgetUsd: input.budgetUsd,
    weights: input.weights,
  });

  return toPublic(session);
}

export function getSession(sessionId: string): AuditSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return advance(session);
}

export async function approveAgent(
  sessionId: string,
  agentId: string,
): Promise<AuditSession | { error: string }> {
  const session = sessions.get(sessionId);
  if (!session) return { error: "Session not found" };

  const current = advance(session);
  if (current.state.stage !== "evaluating") {
    return { error: `Cannot approve agent in stage: ${current.state.stage}` };
  }

  const sample = current.state.samples.find((s) => s.agentId === agentId);
  if (!sample) return { error: "Agent not found in sample evaluations" };

  const bid = current.state.bids.find((b) => b.id === agentId);
  const quoteUsd = bid?.quoteUsd ?? 0;

  // Record agent selection on HCS
  const selectEvent = await recordAuditEvent(
    sessionId,
    "AGENT_SELECTED",
    `Selected ${sample.agentName}`,
    { agentId, quoteUsd },
    agentId,
  );

  session.messages.push(
    makeMsg(`Approved **${sample.agentName}**. Executing task...`),
  );

  // Record escrow lock on HCS
  const escrowEvent = await recordAuditEvent(
    sessionId,
    "ESCROW_LOCKED",
    `Escrow locked: ${formatUsd(quoteUsd)}`,
    { amount: quoteUsd },
  );

  // Build delivery
  const delivery = buildDeliveryReport(sample.agentName, session.input.taskDescription);

  // Record payment release on HCS
  const paymentEvent = await recordAuditEvent(
    sessionId,
    "PAYMENT_RELEASED",
    `Payment released to ${sample.agentName}: ${formatUsd(quoteUsd)}`,
    { amount: quoteUsd, agentId },
    agentId,
  );

  // Record task completion on HCS
  const completeEvent = await recordAuditEvent(
    sessionId,
    "TASK_COMPLETED",
    "Task completed",
    { agentId, agentName: sample.agentName },
  );

  session.messages.push(
    makeMsg(`Task delivered. **${formatUsd(quoteUsd)}** released from escrow.`),
  );
  session.messages.push(
    makeMsg(
      `Audit complete — **${formatUsd(quoteUsd)}** of **${formatUsd(session.input.budgetUsd)}** budget used. ${session.auditTrail.filter((e) => e.status === "logged").length + 4} events logged to Hedera HCS.`,
    ),
  );

  session.auditTrail = [
    ...session.auditTrail,
    selectEvent,
    escrowEvent,
    paymentEvent,
    completeEvent,
  ];

  session.state = {
    stage: "delivered",
    approvedAgentId: agentId,
    approvedAgentName: sample.agentName,
    quoteUsd,
    delivery,
    auditEvents: session.auditTrail,
  };
  session.updatedAt = Date.now();

  return toPublic(session);
}

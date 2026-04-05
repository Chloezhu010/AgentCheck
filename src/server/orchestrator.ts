import { buildDeliveryReport } from "@/lib/audit-demo-data";
import { generateImage } from "@/server/agents/generate";
import { releaseEscrowPaymentsOnHedera } from "@/server/hedera/payout";
import { getStoredSamples } from "@/server/tools/business";
import {
  appendPaymentReleases,
  buildFinalPaymentRelease,
  buildTrialPaymentReleases,
  filterUnreleasedPaymentReleases,
} from "@/server/payment-ledger";
import { runAgentLoop, parseTrialAgentSelection } from "@/server/orchestrator-loop";
import { makeMsg, generateSessionId, sessions } from "@/server/orchestrator-session";
import { setDeliveredState } from "@/server/orchestrator-state";
import type { Content } from "@google/genai";
import type { AuditSession, IntentInput } from "@/types/audit";
import { IMAGE_AGENT_IDS, type ImageAgentId } from "@/types/agent";
import type { SessionEntry } from "@/server/orchestrator-session";

export function createSession(input: IntentInput): AuditSession {
  const id = generateSessionId();
  const now = Date.now();

  const session: AuditSession = {
    id,
    input,
    state: { stage: "agentic" },
    pendingQuestion: undefined,
    messages: [
      makeMsg(
        `Task received. Starting autonomous procurement for: "${input.taskDescription}" with budget $${input.budgetUsd.toFixed(2)}.`,
      ),
    ],
    auditTrail: [],
    paymentReleases: [],
    createdAt: now,
    updatedAt: now,
  };

  const initialContent: Content = {
    role: "user",
    parts: [
      {
        text: `New procurement task:\n- Description: ${input.taskDescription}\n- Budget: $${input.budgetUsd}\n- Weights: quality=${input.weights.quality}, price=${input.weights.price}, speed=${input.weights.speed}\n- Session ID: ${id}\n\nBegin the procurement flow. Start by logging the task intent to Hedera, then broadcast the RFQ.`,
      },
    ],
  };

  const entry: SessionEntry = {
    session,
    agentHistory: [initialContent],
    currentBids: [],
    loopRunning: false,
  };
  sessions.set(id, entry);

  runAgentLoop(id).catch((err) => {
    const currentEntry = sessions.get(id);
    if (currentEntry) {
      markLoopError(currentEntry, err);
    }
  });

  return session;
}

export function getSession(sessionId: string): AuditSession | null {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  return entry.session;
}

export function respondToAgent(
  sessionId: string,
  userMessage: string,
): AuditSession | { error: string } {
  const entry = sessions.get(sessionId);
  if (!entry) return { error: "Session not found" };

  if (!entry.session.pendingQuestion) {
    return { error: "No pending question to respond to" };
  }

  const selectedTrialAgents = parseTrialAgentSelection(userMessage);
  if (selectedTrialAgents) {
    entry.trialAgentIds = selectedTrialAgents;
  }

  entry.session.pendingQuestion = undefined;

  if (entry.pendingAskCallId) {
    entry.agentHistory.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            id: entry.pendingAskCallId,
            name: "ask_user",
            response: { userResponse: userMessage },
          },
        },
      ],
    });
    entry.pendingAskCallId = undefined;
  } else {
    entry.agentHistory.push({
      role: "user",
      parts: [{ text: userMessage }],
    });
  }

  entry.session.updatedAt = Date.now();

  if (!entry.loopRunning) {
    runAgentLoop(sessionId).catch((err) => {
      markLoopError(entry, err);
    });
  }

  return entry.session;
}

export async function finalizeDelivery(
  sessionId: string,
  agentId: string,
): Promise<AuditSession | { error: string }> {
  const entry = sessions.get(sessionId);
  if (!entry) return { error: "Session not found" };

  const samples = getStoredSamples(sessionId);
  const sample = samples.find((s) => s.agentId === agentId);
  if (!sample) return { error: "Agent not found in samples" };

  if (!isImageAgentId(agentId)) {
    return { error: `Unsupported agent id: ${agentId}` };
  }

  const pendingTrialReleases = filterUnreleasedPaymentReleases(
    entry.session,
    buildTrialPaymentReleases(samples, entry.currentBids),
  );
  if (pendingTrialReleases.length > 0) {
    try {
      const onChainTrialReleases = await releaseEscrowPaymentsOnHedera(
        sessionId,
        pendingTrialReleases,
      );
      const releasedTrialPayments = appendPaymentReleases(
        entry.session,
        onChainTrialReleases,
      );
      const trialSummary = releasedTrialPayments
        .map(
          (payment) =>
            `${payment.agentName} $${payment.amountUsd.toFixed(2)} / ${payment.amountHbar?.toFixed(4) ?? "?"} HBAR (${payment.txId})`,
        )
        .join(", ");
      entry.session.messages.push(
        makeMsg(`Released trial escrow payments on Hedera: ${trialSummary}.`, "toolCall"),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown trial payment release error";
      entry.session.messages.push(makeMsg(`Trial escrow release failed: ${message}`));
      entry.session.updatedAt = Date.now();
      return { error: `Trial escrow release failed: ${message}` };
    }
  }

  entry.session.messages.push(
    makeMsg(`Approved ${sample.agentName}. Generating final delivery...`, "toolCall"),
  );
  entry.session.updatedAt = Date.now();

  let deliveryResult;
  try {
    deliveryResult = await generateImage(agentId, entry.session.input.taskDescription, {
      phase: "deliver",
      taskKind: sample.taskKind,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "unknown delivery generation error";
    entry.session.messages.push(makeMsg(`Delivery generation failed: ${message}`));
    entry.session.updatedAt = Date.now();
    return { error: `Delivery generation failed: ${message}` };
  }

  const imageDataUrl = `data:${deliveryResult.mimeType};base64,${deliveryResult.imageBase64}`;
  const comicFrames = deliveryResult.comicFrames?.map((frame) => ({
    panelNumber: frame.panelNumber,
    beat: frame.beat,
    imageDataUrl: `data:${frame.mimeType};base64,${frame.imageBase64}`,
  }));
  const delivery = buildDeliveryReport(sample.agentName, entry.session.input.taskDescription, {
    taskKind: deliveryResult.taskKind,
    imageDataUrl:
      deliveryResult.taskKind === "four-panel-comic" ? undefined : imageDataUrl,
    comicFrames:
      deliveryResult.taskKind === "four-panel-comic" ? comicFrames : undefined,
    generatorNotes: deliveryResult.textResponse.trim(),
  });

  const finalPaymentRelease = buildFinalPaymentRelease(
    agentId,
    sample.agentName,
    entry.currentBids,
  );
  const pendingFinalReleases = finalPaymentRelease
    ? filterUnreleasedPaymentReleases(entry.session, [finalPaymentRelease])
    : [];
  if (pendingFinalReleases.length > 0) {
    try {
      const onChainFinalReleases = await releaseEscrowPaymentsOnHedera(
        sessionId,
        pendingFinalReleases,
      );
      const releasedFinalPayments = appendPaymentReleases(
        entry.session,
        onChainFinalReleases,
      );
      const releasedFinal = releasedFinalPayments[0];
      entry.session.messages.push(
        makeMsg(
          `Released final escrow payment on Hedera: ${releasedFinal.agentName} $${releasedFinal.amountUsd.toFixed(2)} / ${releasedFinal.amountHbar?.toFixed(4) ?? "?"} HBAR (${releasedFinal.txId}).`,
          "toolCall",
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown final payment release error";
      entry.session.messages.push(makeMsg(`Final escrow release failed: ${message}`));
      entry.session.updatedAt = Date.now();
      return { error: `Final escrow release failed: ${message}` };
    }
  }

  setDeliveredState(entry, {
    agentId,
    agentName: sample.agentName,
    quoteUsd: entry.currentBids.find((bid) => bid.id === agentId)?.quoteUsd ?? 0,
  }, delivery);

  entry.session.messages.push(
    makeMsg(
      deliveryResult.taskKind === "four-panel-comic"
        ? `Final delivery ready: 4 coherent comic panels generated by ${sample.agentName}.`
        : `Final delivery ready: image generated by ${sample.agentName}.`,
    ),
  );
  entry.session.updatedAt = Date.now();

  return entry.session;
}

function isImageAgentId(value: string): value is ImageAgentId {
  return IMAGE_AGENT_IDS.includes(value as ImageAgentId);
}

function markLoopError(entry: SessionEntry, err: unknown): void {
  entry.session.messages.push(
    makeMsg(`Agent loop error: ${err instanceof Error ? err.message : "unknown"}`),
  );
  entry.session.state = {
    stage: "error",
    message: err instanceof Error ? err.message : "Agent loop failed",
  };
  entry.session.updatedAt = Date.now();
}

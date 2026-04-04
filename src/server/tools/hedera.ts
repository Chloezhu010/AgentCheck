import {
  TopicMessageSubmitTransaction,
  TransferTransaction,
  Hbar,
  HbarUnit,
  TopicId,
} from "@hashgraph/sdk";
import { getHederaClient } from "@/server/hedera/client";
import { getAccountBalance } from "@/server/hedera/mirror";
import type { FunctionDeclaration } from "@google/genai";

// Gemini function declarations

export const hederaFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "hcs_submit_message",
    description:
      "Submit an audit log message to Hedera Consensus Service (powered by Hedera Agent Kit). Use this to record important events: task intents, bid results, scoring outcomes, agent selection, escrow actions, and task completion.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        topicId: {
          type: "string",
          description:
            "HCS topic ID. Use the value from HEDERA_AUDIT_TOPIC_ID env var.",
        },
        message: {
          type: "string",
          description:
            "JSON string of the audit event to log. Should include event type and relevant data.",
        },
      },
      required: ["topicId", "message"],
      additionalProperties: false,
    },
  },
  {
    name: "hbar_transfer",
    description:
      "Transfer HBAR between accounts (powered by Hedera Agent Kit). Use for escrow lock (operator → escrow) or payment release (escrow → agent). Max 300 HBAR per transfer on testnet.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        toAccountId: {
          type: "string",
          description: "Destination Hedera account ID (e.g. 0.0.12345).",
        },
        amount: {
          type: "number",
          description: "Amount in HBAR to transfer. Max 1 on testnet.",
        },
      },
      required: ["toAccountId", "amount"],
      additionalProperties: false,
    },
  },
  {
    name: "hbar_get_balance",
    description:
      "Check the HBAR balance of a Hedera account (powered by Hedera Agent Kit).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        accountId: {
          type: "string",
          description: "Hedera account ID to check balance for.",
        },
      },
      required: ["accountId"],
      additionalProperties: false,
    },
  },
];

// Tool executors — uses @hashgraph/sdk with Hedera Agent Kit patterns (autonomous execution)

export async function executeHederaTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const client = getHederaClient();

  switch (name) {
    case "hcs_submit_message": {
      const topicId =
        (args.topicId as string) || process.env.HEDERA_AUDIT_TOPIC_ID || "";
      const message = args.message as string;

      const tx = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(message);

      const response = await tx.execute(client);
      const receipt = await response.getReceipt(client);

      return {
        status: receipt.status.toString(),
        sequenceNumber: receipt.topicSequenceNumber?.toString() ?? "",
        transactionId: response.transactionId.toString(),
      };
    }
    case "hbar_transfer": {
      const toAccountId = args.toAccountId as string;
      const amount = args.amount as number;
      if (amount > 300) {
        return { error: "Transfer exceeds 300 HBAR testnet safety limit" };
      }

      const tx = new TransferTransaction()
        .addHbarTransfer(
          client.operatorAccountId!,
          Hbar.from(-amount, HbarUnit.Hbar),
        )
        .addHbarTransfer(toAccountId, Hbar.from(amount, HbarUnit.Hbar));

      const response = await tx.execute(client);
      const receipt = await response.getReceipt(client);

      return {
        status: receipt.status.toString(),
        transactionId: response.transactionId.toString(),
      };
    }
    case "hbar_get_balance": {
      const accountId = args.accountId as string;
      const balance = await getAccountBalance(accountId);
      return { accountId, balanceHbar: balance };
    }
    default:
      return { error: `Unknown hedera tool: ${name}` };
  }
}

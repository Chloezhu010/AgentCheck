import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";

// Orchestrator client (main operator)

let orchestratorClient: Client | null = null;

export function getHederaClient(): Client {
  if (orchestratorClient) return orchestratorClient;

  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  if (!accountId || !privateKey) {
    throw new Error(
      "Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY in environment",
    );
  }

  const network = process.env.HEDERA_NETWORK ?? "testnet";
  orchestratorClient =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  orchestratorClient.setOperator(
    AccountId.fromString(accountId),
    PrivateKey.fromStringDer(privateKey),
  );

  return orchestratorClient;
}

// Escrow client (holds locked funds)

let escrowClient: Client | null = null;

export function getEscrowClient(): Client {
  if (escrowClient) return escrowClient;

  const accountId = process.env.HEDERA_ESCROW_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_ESCROW_PRIVATE_KEY;
  if (!accountId || !privateKey) {
    throw new Error(
      "Missing HEDERA_ESCROW_ACCOUNT_ID or HEDERA_ESCROW_PRIVATE_KEY in environment",
    );
  }

  const network = process.env.HEDERA_NETWORK ?? "testnet";
  escrowClient =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  escrowClient.setOperator(
    AccountId.fromString(accountId),
    PrivateKey.fromStringDer(privateKey),
  );

  return escrowClient;
}

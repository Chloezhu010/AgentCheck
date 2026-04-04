import { NextResponse } from "next/server";
import { getAccountBalance } from "@/server/hedera/mirror";

export async function GET() {
  const orchId = process.env.HEDERA_ACCOUNT_ID;
  const escrowId = process.env.HEDERA_ESCROW_ACCOUNT_ID;

  if (!orchId || !escrowId) {
    return NextResponse.json(
      { error: "Hedera account IDs not configured" },
      { status: 500 },
    );
  }

  try {
    const [orchBalance, escrowBalance] = await Promise.all([
      getAccountBalance(orchId),
      getAccountBalance(escrowId),
    ]);

    return NextResponse.json({
      accounts: [
        { id: orchId, label: "Orchestrator", balance: orchBalance },
        { id: escrowId, label: "Escrow", balance: escrowBalance },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

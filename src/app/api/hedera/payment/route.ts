import { NextRequest, NextResponse } from "next/server";
import { escrowLock, escrowRelease } from "@/server/hedera/payment";

// POST — escrow lock or release
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, taskId, amountHbar, agentAccountId } = body as {
      action: "lock" | "release";
      taskId: string;
      amountHbar: number;
      agentAccountId?: string;
    };

    if (!action || !taskId || !amountHbar) {
      return NextResponse.json(
        { error: "Missing required fields: action, taskId, amountHbar" },
        { status: 400 },
      );
    }

    if (action === "lock") {
      const result = await escrowLock(taskId, amountHbar);
      return NextResponse.json(result);
    }

    if (action === "release") {
      if (!agentAccountId) {
        return NextResponse.json(
          { error: "agentAccountId required for release" },
          { status: 400 },
        );
      }
      const result = await escrowRelease(taskId, agentAccountId, amountHbar);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

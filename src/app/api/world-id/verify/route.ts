import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAndStoreWorldProof, type WorldProofScope } from "@/server/world-id-store";

const BodySchema = z.object({
  action: z.string().min(1),
  scope: z.string().min(1),
  proof: z.unknown(),
});

// Forwards the IDKit payload to World's verify endpoint, then enforces business rules.
// Order: verify with World → enforce uniqueness → store nullifier.
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const response = await fetch(
    `https://developer.world.org/api/v4/verify/${process.env.WORLD_RP_ID!}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data.proof),
    },
  );

  const payload = await response.json();

  if (!response.ok || payload.success !== true) {
    return NextResponse.json(
      { error: "world_id_verification_failed", details: payload },
      { status: 400 },
    );
  }

  const result = checkAndStoreWorldProof({
    action: parsed.data.action,
    scope: parsed.data.scope,
    nullifier: payload.nullifier,
    sessionId: payload.session_id ?? null,
  } satisfies WorldProofScope);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    nullifier: payload.nullifier,
    session_id: payload.session_id ?? null,
  });
}

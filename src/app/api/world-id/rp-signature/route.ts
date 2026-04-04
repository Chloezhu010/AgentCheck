import { NextResponse } from "next/server";
import { z } from "zod";
import { signRequest } from "@worldcoin/idkit-core/signing";

const BodySchema = z.object({
  action: z.string().min(1),
});

// Signs a short-lived RP context for a requested action.
// WORLD_RP_SIGNING_KEY must never be exposed to the client.
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

  const { sig, nonce, createdAt, expiresAt } = signRequest({
    signingKeyHex: process.env.WORLD_RP_SIGNING_KEY!,
    action: parsed.data.action,
  });

  return NextResponse.json({
    rp_id: process.env.WORLD_RP_ID!,
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
    signature: sig,
  });
}

"use client";

import { useCallback, useRef, useState } from "react";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type IDKitErrorCodes,
  type RpContext,
} from "@worldcoin/idkit";

// ── Hook: returns an async trigger() and a <WorldIdModal /> to render ──

type TriggerParams = { action: string; scope: string; signal?: string };

type GateState = {
  open: boolean;
  rpContext: RpContext | null;
  action: string;
  nonce: string;
  preset: ReturnType<typeof orbLegacy>;
};

const INITIAL_STATE: GateState = {
  open: false,
  rpContext: null,
  action: "",
  nonce: "",
  preset: orbLegacy(),
};

export function useWorldIdGate() {
  const [state, setState] = useState<GateState>(INITIAL_STATE);

  // Refs for pending request — avoids stale-closure issues in widget callbacks
  const pendingRef = useRef({ action: "", scope: "" });
  const resolveRef = useRef<(() => void) | null>(null);
  const rejectRef = useRef<((e: Error) => void) | null>(null);

  /** Fetches RP context, opens the QR modal, returns a Promise that resolves on verified success. */
  const trigger = useCallback(async (params: TriggerParams): Promise<void> => {
    const res = await fetch("/api/world-id/rp-signature", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: params.action }),
    });
    if (!res.ok) throw new Error("Failed to get RP signature");
    const rpContext: RpContext = await res.json();

    pendingRef.current = { action: params.action, scope: params.scope };

    return new Promise<void>((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
      setState({
        open: true,
        rpContext,
        action: params.action,
        nonce: rpContext.nonce,
        preset: params.signal ? orbLegacy({ signal: params.signal }) : orbLegacy(),
      });
    });
  }, []);

  const handleSuccess = useCallback(async (result: IDKitResult) => {
    const { action, scope } = pendingRef.current;
    try {
      const verifyRes = await fetch("/api/world-id/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, scope, proof: result }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err?.error ?? "World ID verification failed");
      }
      setState((s) => ({ ...s, open: false }));
      resolveRef.current?.();
    } catch (err) {
      setState((s) => ({ ...s, open: false }));
      rejectRef.current?.(err instanceof Error ? err : new Error(String(err)));
    }
    resolveRef.current = null;
    rejectRef.current = null;
  }, []);

  const handleError = useCallback((code: IDKitErrorCodes) => {
    setState((s) => ({ ...s, open: false }));
    rejectRef.current?.(new Error(`World ID error: ${code}`));
    resolveRef.current = null;
    rejectRef.current = null;
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && rejectRef.current) {
      // User closed the modal manually — reject the pending promise
      rejectRef.current(new Error("World ID verification cancelled"));
      resolveRef.current = null;
      rejectRef.current = null;
    }
    setState((s) => ({ ...s, open: nextOpen }));
  }, []);

  return { trigger, state, handleSuccess, handleError, handleOpenChange };
}

// ── Modal component — render once in your tree ──

export function WorldIdModal({
  gate,
}: {
  gate: ReturnType<typeof useWorldIdGate>;
}) {
  const { state, handleSuccess, handleError, handleOpenChange } = gate;

  if (!state.rpContext) return null;

  return (
    <IDKitRequestWidget
      key={state.nonce}
      open={state.open}
      onOpenChange={handleOpenChange}
      app_id={process.env.NEXT_PUBLIC_WORLD_APP_ID! as `app_${string}`}
      action={state.action}
      rp_context={state.rpContext}
      preset={state.preset}
      allow_legacy_proofs={true}
      environment={
        process.env.NODE_ENV === "production" ? "production" : "staging"
      }
      onSuccess={handleSuccess}
      onError={handleError}
      autoClose
    />
  );
}

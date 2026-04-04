import type { AuditEvent } from "@/types/audit";

type AuditTrailProps = {
  events: AuditEvent[];
};

export function AuditTrail({ events }: AuditTrailProps) {
  if (events.length === 0) return null;

  return (
    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
        A
      </div>
      <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800">
        <p className="mb-2 font-semibold">Hedera HCS Audit Trail</p>
        <ul className="space-y-1">
          {events.map((event) => (
            <li key={event.id} className="flex items-center gap-2 text-xs">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  event.status === "logged" ? "bg-emerald-500" : "bg-amber-400"
                }`}
              />
              <span className="text-zinc-600">{event.label}</span>
              {event.txUrl && (
                <a
                  href={event.txUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  hashscan
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

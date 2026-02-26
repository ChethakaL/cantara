import { ClientStage } from "@prisma/client";
import { stageLabels } from "@/lib/constants";
import { cn } from "@/lib/utils";

const toneByStage: Record<ClientStage, string> = {
  INITIAL_REVIEW: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-[#e8eef5] text-[#1e3a5f] border-[#1e3a5f]/30",
  COMPLETED: "bg-[#e8eef5] text-[#0c1929] border-[#0c1929]/40",
};

export function StageBadge({ stage }: { stage: ClientStage }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.08em] uppercase",
        toneByStage[stage],
      )}
    >
      {stageLabels[stage]}
    </span>
  );
}

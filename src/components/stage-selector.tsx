"use client";

import { ClientStage } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sileo } from "sileo";
import { stageLabels } from "@/lib/constants";

type StageSelectorProps = {
  clientId: string;
  stage: ClientStage;
};

const stageOrder: ClientStage[] = ["INITIAL_REVIEW", "IN_PROGRESS", "COMPLETED"];

export function StageSelector({ clientId, stage }: StageSelectorProps) {
  const router = useRouter();
  const [value, setValue] = useState(stage);
  const [isSaving, setIsSaving] = useState(false);

  async function updateStage(nextStage: ClientStage) {
    setValue(nextStage);
    setIsSaving(true);

    const response = await fetch(`/api/admin/client/${clientId}/stage`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stage: nextStage }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      sileo.error({
        title: "Stage update failed",
        description: payload.error ?? "Failed to update stage",
      });
      setValue(stage);
      setIsSaving(false);
      return;
    }

    sileo.success({
      title: "Stage updated",
      description: `Client moved to ${stageLabels[nextStage]}.`,
    });
    setIsSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <label htmlFor="stage-select" className="block text-xs font-semibold tracking-[0.14em] text-[color:var(--ink-soft)] uppercase">
        Stage
      </label>
      <select
        id="stage-select"
        value={value}
        disabled={isSaving}
        onChange={(event) => void updateStage(event.target.value as ClientStage)}
        className="w-full rounded-xl border border-[color:var(--navy)]/20 bg-white px-3 py-2 text-sm text-[color:var(--navy)] outline-none ring-[color:var(--navy)] transition focus:ring"
      >
        {stageOrder.map((item) => (
          <option value={item} key={item}>
            {stageLabels[item]}
          </option>
        ))}
      </select>
    </div>
  );
}

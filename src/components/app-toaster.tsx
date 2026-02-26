"use client";

import { Toaster } from "sileo";

export function AppToaster() {
  return (
    <Toaster
      theme="light"
      position="top-right"
      offset={{ top: 26, right: 22 }}
      options={{
        duration: 3800,
        fill: "#0f1720",
        roundness: 16,
        styles: {
          title: "font-semibold tracking-[0.01em]",
          description: "text-[13px]",
          badge: "font-semibold",
        },
      }}
    />
  );
}

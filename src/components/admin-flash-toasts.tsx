"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { sileo } from "sileo";

export function AdminFlashToasts() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    const driveConnected = searchParams.get("drive_connected");
    const driveError = searchParams.get("drive_error");

    if (!driveConnected && !driveError) {
      return;
    }

    handledRef.current = true;

    if (driveConnected === "1") {
      sileo.success({
        title: "Google Drive connected",
        description: "You can now choose a Drive location.",
      });
    }

    if (driveError) {
      sileo.error({
        title: "Google Drive OAuth error",
        description: driveError,
      });
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("drive_connected");
    nextParams.delete("drive_error");

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [pathname, router, searchParams]);

  return null;
}

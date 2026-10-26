"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/toast";

export function FlashToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const lastKey = useRef("");

  const success = params.get("success");
  const error = params.get("error");

  useEffect(() => {
    if (!success && !error) {
      lastKey.current = "";
      return;
    }

    const key = `${success ?? ""}|${error ?? ""}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    if (success) {
      toast({ title: "Berhasil", description: success, variant: "success" });
    }
    if (error) {
      toast({ title: "Gagal", description: error, variant: "error" });
    }

    const next = new URLSearchParams(params.toString());
    next.delete("success");
    next.delete("error");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [error, params, pathname, router, success, toast]);

  return null;
}

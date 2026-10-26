import Link from "next/link";
import { Filter, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FilterBar({
  children,
  resetHref,
  title = "Filter",
  description,
  formClassName,
  submitLabel = "Terapkan",
}: {
  children: ReactNode;
  resetHref: string;
  title?: string;
  description?: string;
  formClassName?: string;
  submitLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <form
          method="get"
          className={cn("grid gap-3", formClassName)}
        >
          {children}
          <div className="flex flex-wrap items-center gap-2 md:col-span-full">
            <Button type="submit">{submitLabel}</Button>
            <Link
              href={resetHref}
              className={buttonVariants({ variant: "ghost" })}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

import type { ReactNode } from "react";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface DetailSheetHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  rightSlot?: ReactNode;
  titleClassName?: string;
  subtitleClassName?: string;
}

export function DetailSheetHeader({
  title,
  subtitle,
  rightSlot,
  titleClassName = "text-[2rem] font-black tracking-[-0.05em] text-slate-900 leading-[1.05]",
  subtitleClassName = "mt-2 text-base font-medium text-slate-600",
}: DetailSheetHeaderProps) {
  return (
    <SheetHeader className="border-b border-slate-100 px-6 pt-5 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <SheetTitle className={titleClassName}>{title}</SheetTitle>
          {subtitle ? (
            <SheetDescription className={subtitleClassName}>{subtitle}</SheetDescription>
          ) : null}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    </SheetHeader>
  );
}

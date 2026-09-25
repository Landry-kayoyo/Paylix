"use client";

import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type StatusDialogVariant = "success" | "error" | "info";

interface StatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: StatusDialogVariant;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  hideCancel?: boolean;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  className?: string;
}

const variantTheme: Record<
  StatusDialogVariant,
  { icon: typeof CheckCircle2; accent: string; button: string }
> = {
  success: {
    icon: CheckCircle2,
    accent: "text-emerald-700",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  error: {
    icon: XCircle,
    accent: "text-red-700",
    button: "bg-red-600 hover:bg-red-700 text-white",
  },
  info: {
    icon: Info,
    accent: "text-sky-700",
    button: "bg-sky-600 hover:bg-sky-700 text-white",
  },
};

export function StatusDialog({
  open,
  onOpenChange,
  variant = "success",
  title,
  description,
  children,
  confirmLabel = "OK",
  cancelLabel = "Annuler",
  onConfirm,
  onCancel,
  hideCancel = false,
  confirmDisabled = false,
  confirmLoading = false,
  className,
}: StatusDialogProps) {
  const theme = variantTheme[variant];
  const Icon = theme.icon;

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen && onCancel) onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden p-0 sm:max-w-[520px] ${className ?? ""}`} showCloseButton={false}>
        <DialogHeader className="shrink-0 space-y-3 px-6 pt-6">
          <div className={`flex items-center gap-2 ${theme.accent}`}>
            <Icon className="h-5 w-5" />
            <DialogTitle className="text-left text-[1.05rem] font-semibold text-slate-900">
              {title}
            </DialogTitle>
          </div>
          {description && (
            <DialogDescription className="text-left text-sm text-slate-600">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {children && <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>}

        <DialogFooter className="!mx-0 !mb-0 shrink-0 gap-2 rounded-none border-t border-slate-200 bg-slate-50/60 px-6 py-4">
          {!hideCancel && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                handleClose(false);
              }}
            >
              {cancelLabel}
            </Button>
          )}
          {onConfirm && (
            <Button
              type="button"
              className={theme.button}
              onClick={onConfirm}
              disabled={confirmDisabled || confirmLoading}
            >
              {confirmLoading ? "Chargement..." : confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SuccessDialog(props: Omit<StatusDialogProps, "variant">) {
  return <StatusDialog {...props} variant="success" />;
}

export function ErrorDialog(props: Omit<StatusDialogProps, "variant">) {
  return <StatusDialog {...props} variant="error" />;
}

export function InfoDialog(props: Omit<StatusDialogProps, "variant">) {
  return <StatusDialog {...props} variant="info" />;
}

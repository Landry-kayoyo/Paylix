"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { getParentReceiptDetails } from "./actions";
import { ReceiptDocument } from "@/components/receipts/receipt-document";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function ParentReceiptPreview({ receiptId }: { receiptId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any>(null);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    const result = await getParentReceiptDetails(receiptId);
    if ("data" in result && result.data) {
      setReceipt(result.data);
    } else {
      setError(("error" in result ? result.error : undefined) || "Impossible de charger le reçu.");
    }
    setLoading(false);
  };

  return (
    <>
      <Button size="sm" variant="outline" className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 h-9" onClick={handleOpen}>
        <FileText className="h-3.5 w-3.5" />
        Voir le reçu
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="min-w-0 max-w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto p-3 sm:max-w-4xl sm:p-6">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-emerald-600" />
              Chargement du reçu...
            </div>
          ) : receipt ? (
            <ReceiptDocument receipt={receipt} />
          ) : (
            <div className="p-4 text-center text-rose-600">{error || "Impossible de charger le reçu."}</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

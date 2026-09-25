import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReceiptDocument } from "@/components/receipts/receipt-document";
import { getParentReceiptDetails } from "../../actions";

interface PageProps {
  params: Promise<{ receiptId: string }>;
}

export default async function ParentReceiptPage({ params }: PageProps) {
  const { receiptId } = await params;
  const result = await getParentReceiptDetails(receiptId);

  if ("error" in result && result.error === "Unauthorized") redirect("/login");
  if ("error" in result || !("data" in result) || !result.data) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4 print:hidden">
        <Link href="/parent/receipts">
          <Button variant="outline" size="icon" aria-label="Retour aux reçus"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reçu de paiement</h1>
          <p className="text-muted-foreground">Document officiel du paiement enregistré.</p>
        </div>
      </div>
      <ReceiptDocument receipt={result.data} />
    </div>
  );
}

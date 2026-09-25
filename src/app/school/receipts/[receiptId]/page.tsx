import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReceiptDocument } from "@/components/receipts/receipt-document";
import { getReceiptDetails } from "@/app/actions/receipts";

interface PageProps {
  params: Promise<{ receiptId: string }>;
}

export default async function SchoolReceiptPage({ params }: PageProps) {
  const { receiptId } = await params;
  const result = await getReceiptDetails(receiptId);

  if (result.error === "Unauthorized") redirect("/login");
  if (result.error || !result.data) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in duration-500 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/school/receipts">
            <Button variant="outline" size="icon" aria-label="Retour aux reçus">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reçu Officiel</h1>
            <p className="text-muted-foreground">Document du paiement enregistré.</p>
          </div>
        </div>
      </div>
      <ReceiptDocument receipt={result.data} />
    </div>
  );
}

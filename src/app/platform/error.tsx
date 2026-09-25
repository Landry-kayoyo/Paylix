"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <ErrorState
        title="Erreur lors du chargement"
        description="Impossible de charger cette page. Veuillez réessayer ou contacter le support si le problème persiste."
        onRetry={reset}
      />
    </div>
  );
}

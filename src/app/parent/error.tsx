"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <ErrorState
        title="Erreur lors du chargement"
        description="Impossible de charger votre portail. Veuillez réessayer."
        onRetry={reset}
      />
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, FileQuestion } from "lucide-react";

export default function PlatformNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
        <FileQuestion className="h-8 w-8" />
      </div>
      <p className="text-5xl font-black text-primary">404</p>
      <h2 className="mt-3 text-xl font-bold text-foreground">Page introuvable</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        Cette section n&apos;existe pas encore ou n&apos;est pas accessible avec votre rôle.
      </p>
      <Link href="/" className="mt-6">
        <Button>
          <Home className="mr-2 h-4 w-4" />
          Retour au tableau de bord
        </Button>
      </Link>
    </div>
  );
}

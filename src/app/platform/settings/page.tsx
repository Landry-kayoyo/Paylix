import { Metadata } from "next";
import { getPlatformSettings } from "./actions";
import { PlatformSettingsForm } from "@/components/platform/settings-form";

export const metadata: Metadata = {
  title: "Paramètres Plateforme | Paylix",
  description: "Configuration globale de la plateforme SaaS.",
};

export default async function PlatformSettingsPage() {
  let settings: any = {};

  try {
    settings = await getPlatformSettings();
  } catch {
    // En cas d'erreur critique (non-auth), le middleware redirigera
    // Sinon, on continue avec des valeurs par défaut
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Paramètres de la Plateforme</h1>
        <p className="text-gray-500 mt-1.5 text-sm">
          Gérez la configuration globale, les préférences par défaut et les paramètres système de Paylix.
        </p>
      </div>
      <PlatformSettingsForm initialSettings={settings} />
    </div>
  );
}

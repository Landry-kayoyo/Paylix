import { Metadata } from "next";
import { getSchoolSettings } from "./actions";
import { SchoolSettingsForm } from "@/components/school/settings-form";
import Image from "next/image";
import { Building2, Settings2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Paramètres Établissement | Paylix",
  description: "Personnalisez votre établissement scolaire : logo, nom, description, contacts et documents.",
};

export default async function SchoolSettingsPage() {
  let settings: any = null;
  let loadError: string | null = null;

  try {
    settings = await getSchoolSettings();
  } catch (e: any) {
    loadError = e?.message ?? "Impossible de charger les paramètres.";
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* ── Header with live preview ─────────────────────────────────── */}
      <div className="flex items-start gap-5">
        {/* Logo preview */}
        <div className="h-16 w-16 rounded-2xl border border-border/60 bg-card flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
          {settings?.logo_url ? (
            <Image
              src={settings.logo_url}
              alt="Logo établissement"
              width={56}
              height={56}
              className="object-contain w-full h-full"
              unoptimized
            />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {settings?.name || "Paramètres Établissement"}
            </h1>
            {settings?.short_name && (
              <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                {settings.short_name}
              </span>
            )}
          </div>
          {settings?.description ? (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{settings.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              Personnalisez les informations de votre établissement.
            </p>
          )}
          {(settings?.city || settings?.contact_email) && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {settings?.city && <span>📍 {settings.city}</span>}
              {settings?.contact_email && <span>✉️ {settings.contact_email}</span>}
              {settings?.contact_phone && <span>📞 {settings.contact_phone}</span>}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/40">
          <Settings2 className="h-3.5 w-3.5" />
          Paramètres
        </div>
      </div>

      {/* ── Error / Form ─────────────────────────────────────────────── */}
      {loadError ? (
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 text-destructive">
          <p className="font-semibold mb-1">Erreur de chargement</p>
          <p className="text-sm opacity-80">{loadError}</p>
          <p className="text-sm mt-2 opacity-60">
            Vérifiez que la migration SQL a bien été appliquée dans Supabase.
          </p>
        </div>
      ) : (
        <SchoolSettingsForm initialSettings={settings} />
      )}
    </div>
  );
}

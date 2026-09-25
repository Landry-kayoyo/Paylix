"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { savePlatformSettings } from "@/app/platform/settings/actions";
import { Loader2, Save, CheckCircle2, Globe, Info, Settings2, Pencil, Globe2, Mail, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  platform_info: z.object({
    name: z.string().min(2, "Nom obligatoire").max(100),
    description: z.string().max(500).optional().default(""),
    contact_email: z.union([z.literal(""), z.string().email("E-mail invalide")]).optional().default(""),
    support_url: z.string().max(200).optional().default(""),
  }),
  global_preferences: z.object({
    default_language: z.enum(["fr", "en"]).default("fr"),
    date_format: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).default("DD/MM/YYYY"),
    currency_display: z.enum(["cdf_only", "usd_only", "both"]).default("both"),
  }),
});

type FormData = z.infer<typeof formSchema>;

const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground";

const LANGUAGE_LABELS: Record<string, string> = { fr: "Français (FR)", en: "English (EN)" };
const DATE_LABELS: Record<string, string> = {
  "DD/MM/YYYY": "JJ/MM/AAAA",
  "MM/DD/YYYY": "MM/JJ/AAAA",
  "YYYY-MM-DD": "AAAA-MM-JJ",
};
const CURRENCY_LABELS: Record<string, string> = {
  both: "USD & CDF (toutes)",
  usd_only: "USD uniquement",
  cdf_only: "CDF uniquement",
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value || <span className="text-gray-400 italic">Non renseigné</span>}</p>
    </div>
  );
}

export function PlatformSettingsForm({ initialSettings }: { initialSettings: Record<string, any> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savedSettings, setSavedSettings] = useState(initialSettings);

  const platformInfo = savedSettings.platform_info || {};
  const globalPrefs = savedSettings.global_preferences || {};

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      platform_info: {
        name: platformInfo.name || "Paylix",
        description: platformInfo.description || "",
        contact_email: platformInfo.contact_email || "",
        support_url: platformInfo.support_url || "",
      },
      global_preferences: {
        default_language: globalPrefs.default_language || "fr",
        date_format: globalPrefs.date_format || "DD/MM/YYYY",
        currency_display: globalPrefs.currency_display || "both",
      },
    },
  });

  const handleOpen = () => {
    reset({
      platform_info: {
        name: platformInfo.name || "Paylix",
        description: platformInfo.description || "",
        contact_email: platformInfo.contact_email || "",
        support_url: platformInfo.support_url || "",
      },
      global_preferences: {
        default_language: globalPrefs.default_language || "fr",
        date_format: globalPrefs.date_format || "DD/MM/YYYY",
        currency_display: globalPrefs.currency_display || "both",
      },
    });
    setError(null);
    setOpen(true);
  };

  const onSubmit = async (data: any) => {
    setError(null);
    try {
      const result = await savePlatformSettings(data);
      if (result.success) {
        setSavedSettings({
          platform_info: data.platform_info,
          global_preferences: data.global_preferences,
        });
        setSuccess(true);
        setOpen(false);
        setTimeout(() => setSuccess(false), 4000);
      } else {
        setError(result.error || "Une erreur est survenue.");
      }
    } catch {
      setError("Erreur inattendue. Veuillez réessayer.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast succès */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Paramètres sauvegardés avec succès.</span>
        </div>
      )}

      {/* Carte lecture seule : Informations Générales */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Informations Générales</CardTitle>
                <CardDescription className="text-xs">Identité de la plateforme SaaS</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleOpen}>
              <Pencil className="w-4 h-4" />
              Modifier
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ReadOnlyField label="Nom de la plateforme" value={platformInfo.name || "Paylix"} />
            <ReadOnlyField label="E-mail de contact" value={platformInfo.contact_email || "—"} />
            <ReadOnlyField label="Description" value={platformInfo.description || "—"} />
            <ReadOnlyField label="URL du support" value={platformInfo.support_url || "—"} />
          </div>
        </CardContent>
      </Card>

      {/* Carte lecture seule : Préférences Régionales */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Globe className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Préférences Régionales</CardTitle>
                <CardDescription className="text-xs">Langue, format de date et devises par défaut</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleOpen}>
              <Pencil className="w-4 h-4" />
              Modifier
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <ReadOnlyField label="Langue par défaut" value={LANGUAGE_LABELS[globalPrefs.default_language] || "Français (FR)"} />
            <ReadOnlyField label="Format de date" value={DATE_LABELS[globalPrefs.date_format] || "JJ/MM/AAAA"} />
            <ReadOnlyField label="Devises affichées" value={CURRENCY_LABELS[globalPrefs.currency_display] || "USD & CDF"} />
          </div>
        </CardContent>
      </Card>

      {/* Carte Informations Système */}
      <Card className="bg-slate-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-700">Informations Système</CardTitle>
              <CardDescription className="text-xs">Informations de déploiement (lecture seule)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Environnement</p>
              <p className="text-sm font-semibold text-gray-800">Développement</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Base de données</p>
              <p className="text-sm font-semibold text-gray-800">Supabase PostgreSQL</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Version</p>
              <p className="text-sm font-semibold text-gray-800">Paylix v1.0</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de modification */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Modifier les paramètres</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Informations générales */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Informations Générales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Nom de la plateforme *</label>
                  <input
                    type="text"
                    {...register("platform_info.name")}
                    className={cn(inputClass, errors.platform_info?.name && "border-red-300")}
                    placeholder="Paylix"
                  />
                  {errors.platform_info?.name && <p className="text-xs text-red-500">{errors.platform_info.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">E-mail de contact</label>
                  <input
                    type="email"
                    {...register("platform_info.contact_email")}
                    className={cn(inputClass, errors.platform_info?.contact_email && "border-red-300")}
                    placeholder="contact@paylix.app"
                  />
                  {errors.platform_info?.contact_email && <p className="text-xs text-red-500">{errors.platform_info.contact_email.message as string}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    {...register("platform_info.description")}
                    className={cn(inputClass, "resize-none")}
                    rows={2}
                    placeholder="Plateforme de gestion financière scolaire."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">URL du support</label>
                  <input
                    type="url"
                    {...register("platform_info.support_url")}
                    className={inputClass}
                    placeholder="https://help.paylix.app"
                  />
                </div>
              </div>
            </div>

            {/* Préférences */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Préférences Régionales</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Langue</label>
                  <select {...register("global_preferences.default_language")} className={inputClass}>
                    <option value="fr">Français (FR)</option>
                    <option value="en">English (EN)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Format de date</label>
                  <select {...register("global_preferences.date_format")} className={inputClass}>
                    <option value="DD/MM/YYYY">JJ/MM/AAAA</option>
                    <option value="MM/DD/YYYY">MM/JJ/AAAA</option>
                    <option value="YYYY-MM-DD">AAAA-MM-JJ</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Devises</label>
                  <select {...register("global_preferences.currency_display")} className={inputClass}>
                    <option value="both">USD &amp; CDF</option>
                    <option value="usd_only">USD uniquement</option>
                    <option value="cdf_only">CDF uniquement</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting || !isDirty} className="gap-2 min-w-[130px]">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSubmitting ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { saveSchoolSettings, uploadTenantAsset } from "@/app/school/settings/actions";
import {
  Building2, Phone, Mail, MapPin, FileText, Upload, CheckCircle2,
  Loader2, Globe, Info, Image as ImageIcon, Award, Save,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

const formSchema = z.object({
  name: z.string().min(2, "Nom obligatoire").max(150),
  short_name: z.string().max(50).optional().default(""),
  description: z.string().max(600).optional().default(""),
  city: z.string().max(100).optional().default(""),
  address: z.string().max(300).optional().default(""),
  contact_email: z.union([z.literal(""), z.string().email("E-mail invalide")]).optional().default(""),
  contact_phone: z.string().max(50).optional().default(""),
  receipt_footer_text: z.string().max(500).optional().default(""),
});

type FormData = z.infer<typeof formSchema>;

// ─── Asset Upload Card ─────────────────────────────────────────────────────────
function AssetCard({
  type, label, description, currentUrl, onUploaded
}: {
  type: "logo" | "signature" | "stamp";
  label: string;
  description: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);

    const res = await uploadTenantAsset(fd);
    setUploading(false);

    if (res.success && res.url) {
      onUploaded(res.url);
    } else {
      setError(res.error ?? "Erreur d'upload");
    }
  };

  return (
    <div className="group flex flex-col gap-3 p-5 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {previewUrl && (
          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50 shrink-0">
            Configuré
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-xl border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt={label}
              width={56}
              height={56}
              className="object-contain w-full h-full"
              unoptimized
            />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
          )}
        </div>

        <div className="flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 h-8 text-xs"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploading ? "Envoi..." : previewUrl ? "Changer" : "Uploader"}
          </Button>
          {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, icon: Icon, children, hint, error }: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function SchoolSettingsForm({ initialSettings }: { initialSettings: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: initialSettings?.name ?? "",
      short_name: initialSettings?.short_name ?? "",
      description: initialSettings?.description ?? "",
      city: initialSettings?.city ?? "",
      address: initialSettings?.address ?? "",
      contact_email: initialSettings?.contact_email ?? "",
      contact_phone: initialSettings?.contact_phone ?? "",
      receipt_footer_text: initialSettings?.receipt_footer_text ?? "",
    },
  });

  // Reset form when modal opens to ensure it reflects current DB state
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      reset({
        name: initialSettings?.name ?? "",
        short_name: initialSettings?.short_name ?? "",
        description: initialSettings?.description ?? "",
        city: initialSettings?.city ?? "",
        address: initialSettings?.address ?? "",
        contact_email: initialSettings?.contact_email ?? "",
        contact_phone: initialSettings?.contact_phone ?? "",
        receipt_footer_text: initialSettings?.receipt_footer_text ?? "",
      });
      setGlobalError(null);
    }
  };

  const onSubmit = async (data: FormData) => {
    setGlobalError(null);
    startTransition(async () => {
      const res = await saveSchoolSettings(data);
      if (res.success) {
        setIsOpen(false);
      } else {
        setGlobalError(res.error ?? "Une erreur est survenue.");
      }
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Identité Visuelle (Outside Modal) ───────────────────────────── */}
      <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="p-5 border-b border-border/60 bg-muted/20">
          <h2 className="text-base font-semibold text-foreground">Identité Visuelle</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Fichiers affichés sur vos documents et portails.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          <AssetCard
            type="logo"
            label="Logo"
            description="Max 5MB (PNG/JPG)"
            currentUrl={initialSettings?.logo_url}
            onUploaded={() => {}}
          />
          <AssetCard
            type="signature"
            label="Signature"
            description="Bas des reçus"
            currentUrl={initialSettings?.receipt_signature_url}
            onUploaded={() => {}}
          />
          <AssetCard
            type="stamp"
            label="Sceau / Cachet"
            description="Documents officiels"
            currentUrl={initialSettings?.receipt_stamp_url}
            onUploaded={() => {}}
          />
        </div>
      </section>

      {/* ── Détails de l'établissement (Read-only + Modal) ─────────────── */}
      <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="p-5 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div>
            <h2 className="text-base font-semibold text-foreground">Détails de l'établissement</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Informations et paramètres des reçus.</p>
          </div>
          
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Modifier les détails</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
              <div className="p-6 border-b border-border/60 sticky top-0 bg-background/95 backdrop-blur z-10">
                <DialogTitle className="text-xl">Modifier les paramètres</DialogTitle>
                <DialogDescription className="mt-1.5">
                  Mettez à jour les informations et la personnalisation textuelle de votre établissement.
                </DialogDescription>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">
                {globalError && (
                  <div className="p-4 bg-destructive/10 text-destructive rounded-xl text-sm font-medium border border-destructive/20">
                    {globalError}
                  </div>
                )}

                <div className="space-y-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Informations Générales</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2">
                      <Field label="Nom complet de l'établissement *" icon={Building2} error={errors.name?.message}>
                        <Input {...register("name")} placeholder="Ex: Institut Technique" className={errors.name ? "border-destructive" : ""} />
                      </Field>
                    </div>

                    <Field label="Sigle / Nom court" icon={Award} error={errors.short_name?.message}>
                      <Input {...register("short_name")} placeholder="Ex: ITC-KIN" />
                    </Field>

                    <Field label="Ville / Province" icon={Globe}>
                      <Input {...register("city")} placeholder="Ex: Kinshasa" />
                    </Field>

                    <Field label="Email de contact" icon={Mail} error={errors.contact_email?.message}>
                      <Input {...register("contact_email")} type="email" placeholder="direction@ecole.cd" />
                    </Field>

                    <Field label="Téléphone de contact" icon={Phone}>
                      <Input {...register("contact_phone")} placeholder="+243..." />
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="Adresse complète" icon={MapPin} error={errors.address?.message}>
                        <textarea
                          {...register("address")}
                          rows={2}
                          placeholder="Avenue des écoles..."
                          className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 disabled:opacity-50 resize-none"
                        />
                      </Field>
                    </div>

                    <div className="md:col-span-2">
                      <Field label="Description" icon={Info} error={errors.description?.message} hint="Affichée sur le portail parent.">
                        <textarea
                          {...register("description")}
                          rows={3}
                          placeholder="École fondée en..."
                          className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 disabled:opacity-50 resize-none"
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-border/60">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Paramètres des Reçus</h3>
                  
                  <Field label="Texte de pied de page (Footer)" icon={FileText} hint="Bas de chaque reçu généré. Max 500 caractères.">
                    <textarea
                      {...register("receipt_footer_text")}
                      rows={3}
                      placeholder="Les frais ne sont pas remboursables..."
                      className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 disabled:opacity-50 resize-none"
                    />
                  </Field>
                </div>

                <div className="pt-6 border-t border-border/60 flex justify-end gap-3 sticky bottom-0 bg-background/95 backdrop-blur py-4 -mx-6 px-6 -mb-6">
                  <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={isPending || !isDirty} className="bg-emerald-600 hover:bg-emerald-700 min-w-[140px]">
                    {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enregistrement...</> : <><Save className="h-4 w-4 mr-2" />Enregistrer</>}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Read-only details display */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Nom complet</p>
            <p className="mt-1 text-sm text-foreground font-medium">{initialSettings?.name || "Non défini"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Sigle</p>
            <p className="mt-1 text-sm text-foreground font-medium">{initialSettings?.short_name || "Non défini"}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Description</p>
            <p className="mt-1 text-sm text-foreground">{initialSettings?.description || "Non défini"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Email</p>
            <p className="mt-1 text-sm text-foreground">{initialSettings?.contact_email || "Non défini"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Téléphone</p>
            <p className="mt-1 text-sm text-foreground">{initialSettings?.contact_phone || "Non défini"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Ville</p>
            <p className="mt-1 text-sm text-foreground">{initialSettings?.city || "Non défini"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Adresse complète</p>
            <p className="mt-1 text-sm text-foreground">{initialSettings?.address || "Non défini"}</p>
          </div>

          <div className="md:col-span-2 mt-4 pt-6 border-t border-border/60">
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Texte pied de page (Reçus)</p>
            <p className="mt-1 text-sm text-foreground">{initialSettings?.receipt_footer_text || "Non défini"}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

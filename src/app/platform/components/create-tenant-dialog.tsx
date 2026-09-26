"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Copy, Check, MailCheck } from "lucide-react";
import { createTenantWithDirector } from "../actions";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SuccessDialog } from "@/components/shared/status-dialog";
import { PhoneInput } from "@/components/shared/phone-input";

const createTenantSchema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  slug: z.string().min(2, "L'identifiant (slug) est requis"),
  code: z.string().min(2, "Le code est requis").max(10),
  address: z.string().min(2, "L'adresse est requise"),
  city: z.string().min(2, "La ville est requise"),
  country: z.string().min(2, "Le pays est requis"),
  tenantEmail: z.union([z.literal(""), z.string().email("Email invalide")]),
  fullName: z.string().min(4, "Le nom complet est requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(1, "Le téléphone est requis"),
});

type FormValues = z.infer<typeof createTenantSchema>;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateTenantDialog({ onCreated }: { onCreated?: (tenant: any) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for success modal
  const [inviteSent, setInviteSent] = useState<{
    email: string;
    tenantName: string;
    code: string;
    slug: string;
    address: string;
    city: string;
    fullName: string;
    phone: string;
    emailTransport: string;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: "",
      slug: "",
      code: "",
      address: "",
      city: "",
      country: "République démocratique du Congo",
      tenantEmail: "",
      fullName: "",
      email: "",
      phone: "",
    }
  });

  const nameField = form.register("name");

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    setError(null);
    try {
      const result = await createTenantWithDirector(data);
      if (result.success && result.director && result.tenant) {
        setInviteSent({
          email: result.director.email,
          tenantName: data.name,
          code: data.code,
          slug: data.slug,
          address: data.address,
          city: data.city,
          fullName: data.fullName,
          phone: data.phone,
          emailTransport: result.emailDelivery?.transport ?? "email-provider",
        });
        setOpen(false); // Close create modal
        form.reset();
        if (onCreated) onCreated(result.tenant);
      } else {
        setError(result.error || "Une erreur est survenue.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button className="gap-2" />
          }
        >
          <Building2 className="h-4 w-4" />
          Nouvel établissement
        </DialogTrigger>
        <DialogContent className="flex max-h-[calc(100vh-1rem)] flex-col overflow-hidden p-0 sm:max-w-[680px]">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Créer un établissement</DialogTitle>
            <DialogDescription>
              Ajoutez un nouvel établissement et son responsable initial.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Informations de l’établissement</h4>
                <p className="mt-1 text-xs text-slate-500">Identité, localisation et coordonnées de l’établissement.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Nom</label>
                  <Input
                    {...nameField}
                    onChange={(event) => {
                      nameField.onChange(event);
                      form.setValue("slug", slugify(event.target.value), { shouldValidate: true });
                    }}
                    placeholder="Lycée..."
                    disabled={loading}
                  />
                  {form.formState.errors.name && <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Code (ex: LYC)</label>
                  <Input {...form.register("code")} placeholder="LYC" disabled={loading} />
                  {form.formState.errors.code && <p className="text-xs text-red-500">{form.formState.errors.code.message}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Identifiant (slug)</label>
                <Input {...form.register("slug")} placeholder="lycee-exemple" readOnly disabled={loading} />
                {form.formState.errors.slug && <p className="text-xs text-red-500">{form.formState.errors.slug.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Adresse</label>
                  <Input {...form.register("address")} placeholder="Avenue, quartier, numéro..." disabled={loading} />
                  {form.formState.errors.address && <p className="text-xs text-red-500">{form.formState.errors.address.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Ville</label>
                  <Input {...form.register("city")} placeholder="Lubumbashi" disabled={loading} />
                  {form.formState.errors.city && <p className="text-xs text-red-500">{form.formState.errors.city.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Pays</label>
                  <Input {...form.register("country")} placeholder="République démocratique du Congo" disabled={loading} />
                  {form.formState.errors.country && <p className="text-xs text-red-500">{form.formState.errors.country.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Email de l’établissement <span className="text-slate-400">(optionnel)</span></label>
                  <Input type="email" {...form.register("tenantEmail")} placeholder="contact@ecole.cd" disabled={loading} />
                  {form.formState.errors.tenantEmail && <p className="text-xs text-red-500">{form.formState.errors.tenantEmail.message}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Responsable initial</h4>
                <p className="mt-1 text-xs text-slate-500">Une invitation sera envoyée à son adresse email.</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Nom complet</label>
                <Input {...form.register("fullName")} placeholder="Jean Dupont" disabled={loading} />
                {form.formState.errors.fullName && <p className="text-xs text-red-500">{form.formState.errors.fullName.message}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Téléphone</label>
                  <Controller
                    control={form.control}
                    name="phone"
                    render={({ field }) => <PhoneInput id="tenant-director-phone" value={field.value} onChange={field.onChange} disabled={loading} required validate={false} />}
                  />
                  {form.formState.errors.phone && <p className="text-xs text-red-500">{form.formState.errors.phone.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Email professionnel</label>
                  <Input type="email" {...form.register("email")} placeholder="jean.dupont@ecole.fr" disabled={loading} />
                  {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
                </div>
              </div>
            </div>
            </div>

            <DialogFooter className="!mx-0 !mb-0 shrink-0 border-t border-slate-200 bg-white px-6 py-4">
              <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
                  disabled={loading}
                >
                  {loading ? "Création..." : "Créer l'établissement"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SuccessDialog
        open={!!inviteSent}
        onOpenChange={(val) => { if (!val) setInviteSent(null); }}
        title="Établissement créé avec succès"
        description={
          <span>
            L’établissement est prêt. Une invitation d’activation a été envoyée au responsable.
          </span>
        }
        cancelLabel="Fermer"
        hideCancel={false}
        onCancel={() => setInviteSent(null)}
        className="sm:max-w-[600px]"
      >
        {inviteSent && (
          <div className="space-y-4 py-1">
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Établissement</p>
                <p className="mt-1 font-semibold text-slate-900">{inviteSent.tenantName}</p>
                <p className="text-slate-600">{inviteSent.code} · {inviteSent.slug}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Localisation</p>
                <p className="mt-1 text-slate-700">{inviteSent.address}</p>
                <p className="text-slate-600">{inviteSent.city}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Responsable</p>
                <p className="mt-1 font-semibold text-slate-900">{inviteSent.fullName}</p>
                <p className="text-slate-600">{inviteSent.phone}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Accès</p>
                <p className="mt-1 break-all text-slate-700">{inviteSent.email}</p>
                <div className="mt-2 flex items-center gap-1.5 font-medium text-emerald-700">
                  <MailCheck className="h-4 w-4" />
                  <span>Email envoyé</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Invitation en attente d’activation</p>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-medium">Prochaine étape</p>
              <p className="mt-1 text-emerald-800/90">
                Le responsable doit ouvrir le lien reçu par email pour créer son mot de passe et activer son accès.
              </p>
              <p className="mt-3 border-t border-emerald-200 pt-3 text-xs text-emerald-800/90">
                {inviteSent.emailTransport === "mailpit"
                  ? "Email envoyé et enregistré dans la boîte locale de test."
                  : "Email envoyé et accepté par le fournisseur configuré."}
              </p>
            </div>
          </div>
        )}
      </SuccessDialog>
    </>
  );
}

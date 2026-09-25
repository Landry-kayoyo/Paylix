"use client";

import {
  Building2,
  User,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  ArrowLeft,
  KeyRound,
  Edit,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";
import { useState } from "react";
import { regenerateAccess, updateTenant } from "../../actions";

interface TenantDetailData {
  tenant: {
    id: string;
    name: string;
    slug: string;
    code: string;
    status: string;
    created_at: string;
    updated_at?: string;
  };
  director: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    status: string;
    mustChangePassword: boolean;
    email: string;
  } | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active:    { label: "Actif",     className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    trial:     { label: "Essai",     className: "bg-amber-50 text-amber-700 border-amber-200" },
    suspended: { label: "Suspendu",  className: "bg-rose-50 text-rose-700 border-rose-200" },
    archived:  { label: "Archivé",   className: "bg-slate-100 text-slate-600 border-slate-200" },
  };
  const s = map[status] || { label: status, className: "bg-slate-100 text-slate-600 border-slate-200" };
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

export function TenantDetailClient({ data }: { data: TenantDetailData }) {
  const { tenant: initialTenant, director } = data;
  const [tenant, setTenant] = useState(initialTenant);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: initialTenant.name,
    slug: initialTenant.slug,
    code: initialTenant.code,
    status: initialTenant.status,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenResult, setRegenResult] = useState<{ email: string; transport: "mailpit" | "email-provider" } | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  const openEditDialog = () => {
    setEditForm({
      name: tenant.name,
      slug: tenant.slug,
      code: tenant.code,
      status: tenant.status,
    });
    setEditError(null);
    setEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditError(null);

    try {
      const res = await updateTenant({
        id: tenant.id,
        name: editForm.name,
        slug: editForm.slug,
        code: editForm.code,
        status: editForm.status as any,
      });

      if (res.success && res.tenant) {
        setTenant((current) => ({ ...current, ...res.tenant, updated_at: new Date().toISOString() }));
        setEditOpen(false);
      } else {
        setEditError(res.error || "Erreur lors de la mise à jour.");
      }
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRegenerate = async () => {
    if (!director) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await regenerateAccess(director.id);
      if (res.success && res.email && res.emailDelivery) {
        setRegenResult({ email: res.email, transport: res.emailDelivery.transport });
      } else {
        setRegenError((res as any).error || "Erreur lors de la régénération.");
      }
    } catch (e: any) {
      setRegenError(e.message);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/platform/schools">
          <Button variant="ghost" size="sm" className="gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Retour aux établissements
          </Button>
        </Link>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-emerald-50 p-5 shadow-sm ring-1 ring-slate-200/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{tenant.name}</h1>
              <StatusBadge status={tenant.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">{tenant.code}</span>
              <span className="text-slate-300">•</span>
              <span className="italic text-slate-600">{tenant.slug}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={openEditDialog}>
              <Edit className="h-4 w-4" />
              Modifier
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <User className="h-4 w-4 text-emerald-600" />
              Responsable (Directeur)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {director ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="font-semibold text-slate-900">{director.firstName} {director.lastName}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs">
                      {director.status === "invited" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                          <Clock className="h-3 w-3" /> Invitation en attente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Compte actif
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="truncate font-mono text-xs text-slate-700">{director.email}</span>
                  </div>

                  {director.phone && (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-700">{director.phone}</span>
                    </div>
                  )}

                  {director.mustChangePassword && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>Doit changer son mot de passe à la prochaine connexion.</p>
                    </div>
                  )}
                </div>

                {regenError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {regenError}
                  </div>
                )}

                {director.status === "invited" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    disabled={regenerating}
                    onClick={handleRegenerate}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {regenerating ? "Régénération..." : "Régénérer les accès"}
                  </Button>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Aucun responsable affecté.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Building2 className="h-4 w-4 text-emerald-600" />
              Informations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-0 divide-y divide-slate-100">
              {[
                { label: "Nom complet", value: tenant.name },
                { label: "Code", value: <span className="font-mono text-[11px] rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-slate-700">{tenant.code}</span> },
                { label: "Identifiant (slug)", value: <span className="font-mono text-[11px] text-slate-600">{tenant.slug}</span> },
                { label: "Statut", value: <StatusBadge status={tenant.status} /> },
                { label: "Créé le", value: new Date(tenant.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) },
                { label: "Mis à jour", value: tenant.updated_at ? new Date(tenant.updated_at).toLocaleDateString("fr-FR") : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3.5">
                  <dt className="text-xs font-medium text-slate-500">{label}</dt>
                  <dd className="text-right text-sm font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) setEditOpen(false); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Modifier l'établissement</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations de base de cet établissement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            {editError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {editError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Nom complet</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={savingEdit}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Code</label>
                <Input
                  value={editForm.code}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, code: e.target.value }))}
                  disabled={savingEdit}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Statut</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                  disabled={savingEdit}
                >
                  <option value="active">Actif</option>
                  <option value="trial">Essai</option>
                  <option value="suspended">Suspendu</option>
                  <option value="archived">Archivé</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Identifiant (slug)</label>
              <Input
                value={editForm.slug}
                onChange={(e) => setEditForm((prev) => ({ ...prev, slug: e.target.value }))}
                disabled={savingEdit}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
                Annuler
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!regenResult} onOpenChange={(open) => { if (!open) setRegenResult(null); }}>
        <DialogContent className="sm:max-w-[520px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <Mail className="h-5 w-5" />
              Accès renvoyés par email
            </DialogTitle>
            <DialogDescription>
              Un nouveau lien d’activation a été envoyé au responsable. Aucun mot de passe n’est affiché ici.
            </DialogDescription>
          </DialogHeader>

          {regenResult && (
            <div className="space-y-3 py-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">Email envoyé</p>
                <p className="mt-1 break-all">{regenResult.email}</p>
                <p className="mt-3 border-t border-emerald-200 pt-3 text-xs text-emerald-800/90">
                  {regenResult.transport === "mailpit"
                    ? "Le message est disponible dans la boîte email locale de test."
                    : "Le message a été accepté par le fournisseur email configuré."}
                </p>
              </div>
              <p className="text-sm text-slate-600">
                Le responsable doit utiliser le lien reçu pour définir un nouveau mot de passe.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" onClick={() => setRegenResult(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

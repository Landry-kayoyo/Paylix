"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Search, 
  KeyRound, 
  Edit, 
  MailCheck,
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert,
  MoreVertical,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CreateTenantDialog } from "../components/create-tenant-dialog";
import { regenerateAccess, updateTenant } from "../actions";
import Link from "next/link";

interface TenantWithDirector {
  id: string;
  name: string;
  slug: string;
  code: string;
  status: string;
  created_at: string;
  director: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    status: string;
    mustChangePassword: boolean;
    email: string;
  } | null;
}

export function SchoolsClient({ initialTenants }: { initialTenants: TenantWithDirector[] }) {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantWithDirector[]>(initialTenants);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Edit Tenant State
  const [editingTenant, setEditingTenant] = useState<TenantWithDirector | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", code: "", status: "active" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Regenerate Access State
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [accessModal, setAccessModal] = useState<{
    tenantName: string;
    directorName: string;
    email: string;
    transport: "mailpit" | "email-provider";
  } | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.director?.email && t.director.email.toLowerCase().includes(search.toLowerCase())) ||
      (t.director?.firstName && t.director.firstName.toLowerCase().includes(search.toLowerCase())) ||
      (t.director?.lastName && t.director.lastName.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenEdit = (tenant: TenantWithDirector) => {
    setEditingTenant(tenant);
    setEditForm({
      name: tenant.name,
      slug: tenant.slug,
      code: tenant.code,
      status: tenant.status || "active",
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setSavingEdit(true);
    setEditError(null);

    try {
      const res = await updateTenant({
        id: editingTenant.id,
        name: editForm.name,
        slug: editForm.slug,
        code: editForm.code,
        status: editForm.status as any,
      });

      if (res.success && res.tenant) {
        setTenants(prev => prev.map(t => t.id === editingTenant.id ? { ...t, ...res.tenant } : t));
        setEditingTenant(null);
      } else {
        setEditError(res.error || "Erreur lors de la mise à jour");
      }
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRegenerate = async (tenant: TenantWithDirector) => {
    if (!tenant.director) return;
    setRegeneratingId(tenant.director.id);
    setRegenError(null);

    try {
      const res = await regenerateAccess(tenant.director.id);
      if (res.success && res.email && res.emailDelivery) {
        setAccessModal({
          tenantName: tenant.name,
          directorName: `${tenant.director.firstName} ${tenant.director.lastName}`,
          email: res.email,
          transport: res.emailDelivery.transport,
        });
      } else {
        setRegenError(res.error || "Impossible de régénérer les accès.");
      }
    } catch (err: any) {
      setRegenError(err.message);
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Établissements scolaires</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestion du parc d'établissements, attribution des responsables et sécurité des accès.
          </p>
        </div>
        <CreateTenantDialog onCreated={(newTenant) => setTenants(prev => [newTenant, ...prev])} />
      </div>

      {regenError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{regenError}</span>
        </div>
      )}

      {/* Filters */}
      <Card className="shadow-xs border-slate-200/80">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, code, slug ou responsable..."
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Statut :</span>
              <select
                className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="trial">Essai</option>
                <option value="suspended">Suspendu</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[15px] font-semibold tracking-tight text-slate-900">Tous les établissements</CardTitle>
              <CardDescription className="mt-1 text-xs text-slate-500">
                {filteredTenants.length} établissement{filteredTenants.length > 1 ? "s" : ""} répertorié{filteredTenants.length > 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="w-[28%] border-b border-slate-200 px-5 py-3 text-left">Établissement</th>
                <th className="w-[18%] border-b border-slate-200 px-5 py-3 text-left">Code &amp; identifiant</th>
                <th className="w-[22%] border-b border-slate-200 px-5 py-3 text-left">Responsable</th>
                <th className="w-[14%] border-b border-slate-200 px-5 py-3 text-left">Statut</th>
                <th className="w-[12%] border-b border-slate-200 px-5 py-3 text-left">Accès</th>
                <th className="w-[6%] border-b border-slate-200 px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white text-slate-700">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    Aucun établissement ne correspond à votre recherche.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="border-b border-slate-100 px-5 py-4 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-[11px] font-bold text-emerald-700">
                          {t.code ? t.code.substring(0, 2).toUpperCase() : "EC"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{t.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">Créé le {new Date(t.created_at).toLocaleDateString("fr-FR")}</p>
                        </div>
                      </div>
                    </td>

                    <td className="border-b border-slate-100 px-5 py-4 align-middle">
                      <span className="inline-block rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700">
                        {t.code}
                      </span>
                      <p className="mt-1 truncate text-xs text-slate-500">{t.slug}</p>
                    </td>

                    <td className="border-b border-slate-100 px-5 py-4 align-middle">
                      {t.director ? (
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{t.director.firstName} {t.director.lastName}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{t.director.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-400">Aucun responsable</span>
                      )}
                    </td>

                    <td className="border-b border-slate-100 px-5 py-4 align-middle">
                      <Badge
                        variant="outline"
                        className={
                          t.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : t.status === "trial"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }
                      >
                        {t.status === "active" ? "Actif" : t.status === "trial" ? "Essai" : "Suspendu"}
                      </Badge>
                    </td>

                    <td className="border-b border-slate-100 px-5 py-4 align-middle">
                      {t.director ? (
                        t.director.status === "invited" ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                            <Clock className="h-3.5 w-3.5" />
                            En attente
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Actif
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>

                    <td className="border-b border-slate-100 px-5 py-4 text-right align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/platform/schools/${t.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Voir le détail de l'établissement">
                            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenEdit(t)} title="Modifier l'établissement">
                          <Edit className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Edit Tenant Dialog */}
      <Dialog open={!!editingTenant} onOpenChange={(open) => { if (!open) setEditingTenant(null); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Modifier l'établissement</DialogTitle>
            <DialogDescription>
              Mettez à jour les paramètres de base de l'établissement.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            {editError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-xs">
                {editError}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Nom</label>
              <Input 
                value={editForm.name} 
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                required
                disabled={savingEdit}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Code</label>
                <Input 
                  value={editForm.code} 
                  onChange={(e) => setEditForm(prev => ({ ...prev, code: e.target.value }))}
                  required
                  disabled={savingEdit}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Statut</label>
                <select
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-xs"
                  value={editForm.status}
                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  disabled={savingEdit}
                >
                  <option value="active">Actif</option>
                  <option value="trial">Essai</option>
                  <option value="suspended">Suspendu</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Identifiant (slug)</label>
              <Input 
                value={editForm.slug} 
                onChange={(e) => setEditForm(prev => ({ ...prev, slug: e.target.value }))}
                required
                disabled={savingEdit}
              />
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setEditingTenant(null)} disabled={savingEdit}>
                Annuler
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Regenerate Access Modal */}
      <Dialog open={!!accessModal} onOpenChange={(open) => { if (!open) setAccessModal(null); }}>
        <DialogContent className="sm:max-w-[420px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-amber-600 flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Accès renvoyés par email
            </DialogTitle>
            <DialogDescription>
              Un nouveau lien d’activation a été envoyé au responsable. Aucun mot de passe n’est affiché ici.
            </DialogDescription>
          </DialogHeader>

          {accessModal && (
            <div className="space-y-4 py-3">
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Établissement</p>
                  <p className="font-semibold">{accessModal.tenantName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Responsable</p>
                  <p className="font-medium">{accessModal.directorName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Email destinataire</p>
                  <p className="break-all font-mono">{accessModal.email}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <MailCheck className="h-4 w-4" />
                    Email envoyé
                  </div>
                  <p className="text-xs text-emerald-800/90">
                    {accessModal.transport === "mailpit"
                      ? "Message enregistré dans la boîte email locale de test."
                      : "Message accepté par le fournisseur email configuré."}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Le responsable doit utiliser le lien reçu par email pour définir son nouveau mot de passe.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setAccessModal(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

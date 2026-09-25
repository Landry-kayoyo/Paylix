"use client";

import { useState, useEffect } from "react";
import { getAccountantsData, resendAccountantInvitation, toggleAccountantStatus, AccountantItem } from "./actions";
import { CreateAccountantDialog } from "./create-accountant-dialog";
import { AccountantStatusBadge } from "./accountant-status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { UserCheck, Plus, Search, Send, Power, CheckCircle, Loader2, Users, Eye } from "lucide-react";

function resolveAccountantDisplayName(fullName?: string | null) {
  const trimmed = fullName?.trim();
  return trimmed || "Comptable";
}

export function UsersClient() {
  const [accountants, setAccountants] = useState<AccountantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Renvoi d'invitation
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Modal de confirmation (Désactivation / Réactivation)
  const [selectedAccForToggle, setSelectedAccForToggle] = useState<AccountantItem | null>(null);
  const [isToggleLoading, setIsToggleLoading] = useState(false);

  // Drawer (Sheet) pour les détails
  const [selectedAccDetails, setSelectedAccDetails] = useState<AccountantItem | null>(null);

  const fetchAccountants = async () => {
    setLoading(true);
    const res = await getAccountantsData(1, 50, {
      search: search || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    });
    setAccountants(res.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccountants();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAccountants();
  };

  const handleResendInvitation = async (acc: AccountantItem) => {
    setResendingId(acc.user_id);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    const res = await resendAccountantInvitation(acc.user_id);
    setResendingId(null);

    if (res.success) {
      setActionSuccessMsg(`Invitation renvoyée avec succès à ${acc.email}.`);
      fetchAccountants();
    } else {
      setActionErrorMsg(res.error || "Erreur lors du renvoi de l'invitation.");
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!selectedAccForToggle) return;
    setIsToggleLoading(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    const newStatus = selectedAccForToggle.status === "inactive" ? "active" : "inactive";
    const res = await toggleAccountantStatus(selectedAccForToggle.user_id, newStatus);

    setIsToggleLoading(false);
    setSelectedAccForToggle(null);

    if (res.success) {
      setActionSuccessMsg(
        `Le compte de ${selectedAccForToggle.full_name} a été ${newStatus === "inactive" ? "désactivé" : "réactivé"}.`
      );
      fetchAccountants();
    } else {
      setActionErrorMsg(res.error || "Erreur lors du changement de statut.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Entête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Utilisateurs / Équipe</h1>
          <p className="text-muted-foreground text-sm">
            Gérez le compte et les accès du personnel comptable de votre établissement.
          </p>
        </div>

        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un Comptable
        </Button>
      </div>

      {/* Messages de feedback */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-xs text-emerald-600 underline">Masquer</button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center justify-between">
          <span>{actionErrorMsg}</span>
          <button onClick={() => setActionErrorMsg(null)} className="text-xs text-rose-600 underline">Masquer</button>
        </div>
      )}

      {/* Barre de Filtres et Recherche */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, téléphone ou code..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <select
                className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tous les statuts</option>
                <option value="invited">Invités</option>
                <option value="active">Actifs</option>
                <option value="inactive">Désactivés</option>
              </select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Liste des comptables */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Personnel Comptable ({accountants.length})</CardTitle>
          <CardDescription>Liste des comptables autorisés à enregistrer les paiements et émettre les reçus.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <span>Chargement de la liste des comptables...</span>
            </div>
          ) : accountants.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-3">
              <Users className="h-10 w-10 mx-auto text-slate-300" />
              <p className="font-medium text-slate-700">Aucun comptable trouvé.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Vous n'avez pas encore ajouté de comptable pour votre établissement.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline" className="mt-2">
                <Plus className="mr-2 h-4 w-4 text-emerald-600" /> Ajouter un Comptable
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-md divide-y">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Nom complet</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Téléphone</th>
                    <th className="p-3">Rôle</th>
                    <th className="p-3 text-center">Statut</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accountants.map((acc) => {
                    const fullName = resolveAccountantDisplayName(acc.full_name);

                    return (
                    <tr key={acc.id} className="hover:bg-slate-50/50">
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{fullName}</p>
                        <p className="text-xs font-mono text-slate-500">{acc.employee_code}</p>
                      </td>
                      <td className="p-3 font-mono text-slate-700">{acc.email || "-"}</td>
                      <td className="p-3 font-mono text-slate-700">{acc.phone || "-"}</td>
                      <td className="p-3 font-medium text-slate-800">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs">
                          Comptable
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <AccountantStatusBadge status={acc.status} />
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-600 hover:text-slate-900"
                            onClick={() => setSelectedAccDetails(acc)}
                            title="Voir les détails"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {acc.status === "invited" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResendInvitation(acc)}
                              disabled={resendingId === acc.user_id}
                              title="Renvoyer l'invitation par email"
                            >
                              {resendingId === acc.user_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              ) : (
                                <Send className="h-3.5 w-3.5 mr-1 text-amber-600" />
                              )}
                              Renvoyer invitation
                            </Button>
                          )}

                          {acc.status === "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:bg-rose-50"
                              onClick={() => setSelectedAccForToggle(acc)}
                            >
                              <Power className="h-3.5 w-3.5 mr-1" /> Désactiver
                            </Button>
                          )}

                          {acc.status === "inactive" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-600 hover:bg-emerald-50"
                              onClick={() => setSelectedAccForToggle(acc)}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Réactiver
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Création du Comptable */}
      <CreateAccountantDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={fetchAccountants}
      />

      {/* Dialog de confirmation Désactivation / Réactivation */}
      <Dialog open={!!selectedAccForToggle} onOpenChange={(open) => !open && setSelectedAccForToggle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAccForToggle?.status === "inactive" ? "Réactiver le compte" : "Désactiver le compte"}
            </DialogTitle>
            <DialogDescription>
              {selectedAccForToggle?.status === "inactive"
                ? `Voulez-vous réactiver l'accès au compte de ${resolveAccountantDisplayName(selectedAccForToggle?.full_name)} ? Le comptable pourra de nouveau enregistrer des paiements.`
                : `Voulez-vous désactiver le compte de ${resolveAccountantDisplayName(selectedAccForToggle?.full_name)} ? L'historique et les paiements enregistrés seront conservés, mais le comptable ne pourra plus se connecter.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setSelectedAccForToggle(null)} disabled={isToggleLoading}>
              Annuler
            </Button>
            <Button
              variant={selectedAccForToggle?.status === "inactive" ? "default" : "destructive"}
              onClick={handleConfirmToggleStatus}
              disabled={isToggleLoading}
            >
              {isToggleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {selectedAccForToggle?.status === "inactive" ? "Confirmer la réactivation" : "Confirmer la désactivation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drawer (Sheet) pour les détails */}
      <Sheet open={!!selectedAccDetails} onOpenChange={(open) => !open && setSelectedAccDetails(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Détails du Comptable</SheetTitle>
            <SheetDescription>Informations complètes sur ce membre de l'équipe.</SheetDescription>
          </SheetHeader>
          
          {selectedAccDetails && (
            <div className="mt-6 space-y-6">
              <div className="flex flex-col items-center p-4 bg-slate-50 rounded-lg border">
                <div className="h-16 w-16 bg-emerald-100 text-emerald-700 flex items-center justify-center rounded-full text-xl font-bold mb-3">
                  {resolveAccountantDisplayName(selectedAccDetails.full_name).charAt(0).toUpperCase()}
                </div>
                <h3 className="text-lg font-bold text-slate-900">{resolveAccountantDisplayName(selectedAccDetails.full_name)}</h3>
                <p className="text-sm font-mono text-slate-500">{selectedAccDetails.employee_code}</p>
                <div className="mt-2">
                  <AccountantStatusBadge status={selectedAccDetails.status} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-500 col-span-1">Email</span>
                  <span className="text-sm font-medium col-span-2 text-right break-all">
                    {selectedAccDetails.email || <span className="text-slate-400 italic">Non renseigné</span>}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-500 col-span-1">Téléphone</span>
                  <span className="text-sm font-medium col-span-2 text-right">
                    {selectedAccDetails.phone || <span className="text-slate-400 italic">Non renseigné</span>}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-500 col-span-1">Rôle</span>
                  <span className="text-sm font-medium col-span-2 text-right">Comptable</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-3">
                  <span className="text-sm text-slate-500 col-span-1">Date d'ajout</span>
                  <span className="text-sm font-medium col-span-2 text-right">
                    {new Date(selectedAccDetails.created_at).toLocaleDateString("fr-FR", {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button variant="outline" onClick={() => setSelectedAccDetails(null)}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

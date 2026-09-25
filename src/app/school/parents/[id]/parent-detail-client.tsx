"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, User, Phone, Mail, MapPin, GraduationCap,
  Plus, Trash2, Edit, Send, UserX, UserCheck, Loader2,
  AlertCircle, Calendar, CheckCircle2, X, Save,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusDialog } from "@/components/shared/status-dialog";
import { ParentStatusBadge } from "../parent-status-badge";
import { StudentSearchSelect, type SelectedChild } from "../student-search-select";
import { AFRICAN_COUNTRIES, CountryFlag } from "@/components/shared/phone-input";
import { PHONE_LENGTH_BY_COUNTRY, validateLocalPhoneForCountry } from "../phone-utils";
import {
  updateParent,
  associateStudents,
  removeStudentAssociation,
  resendParentInvitation,
  deactivateParent,
  reactivateParent,
  type ParentItem,
  type ParentStudentLink,
} from "../actions";

interface ParentDetailClientProps {
  parent: ParentItem;
  children: ParentStudentLink[];
  initialEditMode?: boolean;
}

export function ParentDetailClient({
  parent: initialParent,
  children: initialChildren,
  initialEditMode = false,
}: ParentDetailClientProps) {
  const router = useRouter();
  const [parent, setParent] = useState(initialParent);
  const [children, setChildren] = useState(initialChildren);

  // Edit mode
  const [editMode, setEditMode] = useState(initialEditMode);
  const [editForm, setEditForm] = useState({
    full_name: initialParent.full_name,
    phone: initialParent.phone || "",
    address: initialParent.address || "",
  });
  const initialCountry = AFRICAN_COUNTRIES.find((country) => initialParent.phone?.startsWith(country.dialCode)) || AFRICAN_COUNTRIES[0];
  const [phoneCountry, setPhoneCountry] = useState(initialCountry.code);
  const [localPhone, setLocalPhone] = useState(initialParent.phone?.replace(initialCountry.dialCode, "") || "");
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Associate children
  const [assocOpen, setAssocOpen] = useState(false);
  const [assocChildren, setAssocChildren] = useState<SelectedChild[]>([]);
  const [assocLoading, setAssocLoading] = useState(false);
  const [assocError, setAssocError] = useState<string | null>(null);

  // Remove association
  const [removeTarget, setRemoveTarget] = useState<ParentStudentLink | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Global actions
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; title: string; description: string; variant: "success" | "error" | "info" }>({
    open: false,
    title: "",
    description: "",
    variant: "success",
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  // ── Edit parent ────────────────────────────────────────────────────────────────
  async function handleSaveEdit() {
    setEditError(null);
    setSaving(true);
    try {
      const selectedCountry = AFRICAN_COUNTRIES.find((country) => country.code === phoneCountry) || AFRICAN_COUNTRIES[0];
      if (!validateLocalPhoneForCountry(selectedCountry.code, localPhone)) {
        setEditError(`Le numéro doit contenir exactement ${PHONE_LENGTH_BY_COUNTRY[selectedCountry.code] ?? 9} chiffres pour ${selectedCountry.name}.`);
        return;
      }

      const res = await updateParent({
        id: parent.id,
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim() || null,
      });
      if (!res.success) {
        setEditError(res.error || "Erreur de modification.");
        return;
      }
      setParent((p) => ({
        ...p,
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim() || null,
      }));
      setEditMode(false);
      showToast("Informations mises à jour avec succès.");
    } finally {
      setSaving(false);
    }
  }

  // ── Associate children ─────────────────────────────────────────────────────────
  async function handleAssociate() {
    if (assocChildren.length === 0) {
      setAssocError("Sélectionnez au moins un élève.");
      return;
    }

    setAssocLoading(true);
    setAssocError(null);

    try {
      const res = await associateStudents({
        parent_id: parent.id,
        children: assocChildren.map((c) => ({
          student_id: c.student.id,
          relationship: c.relationship,
        })),
      });

      const allFailed = !res.success && (!res.errors || res.errors.length === assocChildren.length);
      if (allFailed) {
        setAssocError(res.error || "Erreur d'association.");
        return;
      }

      if (res.errors && res.errors.length > 0) {
        setAssocError(
          `${res.errors.length} association(s) ont échoué : ${res.errors.map((e) => e.message).join(", ")}`
        );
      }

      if (res.createdLinks && res.createdLinks.length > 0) {
        setChildren((prev) => [...prev, ...res.createdLinks]);
      }

      router.refresh();
      setAssocOpen(false);
      setAssocChildren([]);

      if (res.errors && res.errors.length > 0) {
        showToast("Certaines associations ont échoué. Les autres ont été enregistrées.");
      } else {
        showToast("Enfant(s) associé(s) avec succès.");
      }
    } finally {
      setAssocLoading(false);
    }
  }

  // ── Remove association ─────────────────────────────────────────────────────────
  async function handleRemoveAssociation() {
    if (!removeTarget) return;
    setRemoveLoading(true);
    setRemoveError(null);
    try {
      const res = await removeStudentAssociation(removeTarget.id);
      if (!res.success) {
        setRemoveError(res.error || "Erreur de suppression.");
        return;
      }
      setChildren((prev) => prev.filter((c) => c.id !== removeTarget.id));
      setRemoveTarget(null);
      showToast("Association retirée. L'élève et le parent sont conservés.");
    } finally {
      setRemoveLoading(false);
    }
  }

  // ── Invitation ─────────────────────────────────────────────────────────────────
  async function handleResendInvitation() {
    setActionLoading(true);
    try {
      const res = await resendParentInvitation(parent.id);
      if (res.success) {
        setParent((p) => ({ ...p, last_invitation_sent_at: new Date().toISOString() }));
        setStatusDialog({
          open: true,
          title: "Invitation envoyée",
          description: `Une nouvelle invitation a bien été envoyée à ${parent.email || "ce parent"}.`,
          variant: "success",
        });
      } else {
        setStatusDialog({
          open: true,
          title: "Échec de l'envoi",
          description: res.error || "L'invitation n'a pas pu être envoyée.",
          variant: "error",
        });
      }
    } finally {
      setActionLoading(false);
    }
  }

  // ── Deactivate / Reactivate ────────────────────────────────────────────────────
  async function handleDeactivate() {
    setActionLoading(true);
    try {
      const res = await deactivateParent(parent.id);
      if (res.success) {
        setParent((p) => ({ ...p, account_status: "inactive" }));
        setStatusDialog({
          open: true,
          title: "Compte désactivé",
          description: "Le compte a bien été désactivé. Les données sont conservées.",
          variant: "success",
        });
      } else {
        setStatusDialog({
          open: true,
          title: "Erreur de désactivation",
          description: res.error || "Le compte n'a pas pu être désactivé.",
          variant: "error",
        });
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate() {
    setActionLoading(true);
    try {
      const res = await reactivateParent(parent.id);
      if (res.success) {
        setParent((p) => ({ ...p, account_status: "active" }));
        setStatusDialog({
          open: true,
          title: "Compte réactivé",
          description: "Le compte a bien été réactivé.",
          variant: "success",
        });
      } else {
        setStatusDialog({
          open: true,
          title: "Erreur de réactivation",
          description: res.error || "Le compte n'a pas pu être réactivé.",
          variant: "error",
        });
      }
    } finally {
      setActionLoading(false);
    }
  }

  const fullName = parent.full_name;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg text-sm text-emerald-800 animate-in slide-in-from-bottom-4">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)}>
            <X className="h-4 w-4 text-emerald-500 hover:text-emerald-900" />
          </button>
        </div>
      )}

      <StatusDialog
        open={statusDialog.open}
        onOpenChange={(open) => setStatusDialog((prev) => ({ ...prev, open }))}
        title={statusDialog.title}
        description={statusDialog.description}
        variant={statusDialog.variant}
        cancelLabel="Fermer"
        hideCancel={false}
        onCancel={() => setStatusDialog((prev) => ({ ...prev, open: false }))}
      />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/school/parents">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">
              {fullName}
            </h1>
            <ParentStatusBadge status={parent.account_status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Parent enregistré le {new Date(parent.created_at).toLocaleDateString("fr-FR")}
          </p>
        </div>
        {/* Actions header */}
        <div className="flex items-center gap-2 shrink-0">
          {!editMode && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setEditForm({
                  full_name: parent.full_name,
                  phone: parent.phone || "",
                  address: parent.address || "",
                });
                const country = AFRICAN_COUNTRIES.find((item) => parent.phone?.startsWith(item.dialCode)) || AFRICAN_COUNTRIES[0];
                setPhoneCountry(country.code);
                setLocalPhone(parent.phone?.replace(country.dialCode, "") || "");
                setCountryMenuOpen(false);
                setEditMode(true);
              }}
            >
              <Edit className="h-4 w-4" />
              Modifier
            </Button>
          )}
          {parent.account_status === "invited" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleResendInvitation}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Renvoyer l'invitation
            </Button>
          )}
          {parent.account_status === "active" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={handleDeactivate}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
              Désactiver
            </Button>
          )}
          {parent.account_status === "inactive" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              onClick={handleReactivate}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              Réactiver
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Informations */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-500" />
                  Informations
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-100">
                  <InfoRow label="Nom complet" value={fullName} />
                  {parent.phone && (
                    <InfoRow
                      label="Téléphone"
                      value={
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {parent.phone}
                        </span>
                      }
                    />
                  )}
                  {parent.email && (
                    <InfoRow
                      label="Email"
                      value={
                        <span className="flex items-center gap-1.5 max-w-[160px] truncate">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{parent.email}</span>
                        </span>
                      }
                    />
                  )}
                  {parent.address && (
                    <InfoRow
                      label="Adresse"
                      value={
                        <span className="flex items-center gap-1.5 text-right max-w-[160px]">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{parent.address}</span>
                        </span>
                      }
                    />
                  )}
              </div>
            </CardContent>
          </Card>

          {/* Account section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-slate-500" />
                Compte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-100">
                <InfoRow
                  label="Statut"
                  value={<ParentStatusBadge status={parent.account_status} />}
                />
                {parent.invited_at && (
                  <InfoRow
                    label="Invité le"
                    value={
                      <span className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {new Date(parent.invited_at).toLocaleDateString("fr-FR")}
                      </span>
                    }
                  />
                )}
                {parent.activated_at && (
                  <InfoRow
                    label="Activé le"
                    value={
                      <span className="flex items-center gap-1.5 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        {new Date(parent.activated_at).toLocaleDateString("fr-FR")}
                      </span>
                    }
                  />
                )}
                {parent.last_invitation_sent_at && parent.account_status === "invited" && (
                  <InfoRow
                    label="Dernier envoi"
                    value={
                      <span className="text-xs text-slate-500">
                        {new Date(parent.last_invitation_sent_at).toLocaleDateString("fr-FR")}
                      </span>
                    }
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Children */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-slate-500" />
                  Enfants associés
                  {children.length > 0 && (
                    <Badge variant="secondary" className="text-xs font-normal ml-1">
                      {children.length}
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs"
                  onClick={() => {
                    setAssocChildren([]);
                    setAssocError(null);
                    setAssocOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Associer un enfant
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {children.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-slate-200">
                  <GraduationCap className="h-8 w-8 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-700">Aucun enfant associé</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Ce parent n'a pas encore d'enfant associé.
                  </p>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setAssocChildren([]);
                      setAssocError(null);
                      setAssocOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Associer un enfant
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 group"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 font-bold text-sm border border-indigo-100 shrink-0">
                        {child.student.last_name.charAt(0)}
                        {child.student.first_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {child.student.last_name.toUpperCase()}{" "}
                          {child.student.post_name ? child.student.post_name.toUpperCase() + " " : ""}
                          {child.student.first_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                          <code className="font-mono font-medium text-slate-700">
                            {child.student.matricule}
                          </code>
                          {child.student.current_class && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <GraduationCap className="h-3 w-3" />
                                {child.student.current_class}
                              </span>
                            </>
                          )}
                          {child.relationship && (
                            <>
                              <span>·</span>
                              <Badge variant="outline" className="text-[10px] py-0">
                                {child.relationship}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/school/students/${child.student.id}`}>
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                            Fiche élève
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setRemoveError(null);
                            setRemoveTarget(child);
                          }}
                          title="Retirer l'association"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit parent dialog */}
      <Dialog
        open={editMode}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setEditMode(false);
            setEditError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-emerald-600" />
              Modifier les informations
            </DialogTitle>
            <DialogDescription>
              Mettez à jour les informations personnelles de ce parent.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Nom complet *</label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Téléphone *</label>
              <div className="relative flex h-11 overflow-visible rounded-xl border border-slate-200 bg-white shadow-xs transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                <button
                  type="button"
                  aria-label="Pays et indicatif"
                  aria-expanded={countryMenuOpen}
                  disabled={saving}
                  onClick={() => setCountryMenuOpen((open) => !open)}
                  className="flex items-center gap-1.5 rounded-l-xl border-r border-slate-200 bg-emerald-50/60 px-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-100/70 focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                >
                  <CountryFlag code={AFRICAN_COUNTRIES.find((country) => country.code === phoneCountry)?.code || "CD"} name="Pays sélectionné" />
                  <span>{AFRICAN_COUNTRIES.find((country) => country.code === phoneCountry)?.dialCode}</span>
                </button>
                {countryMenuOpen && (
                  <div role="listbox" aria-label="Pays africains" className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-64 w-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                    {AFRICAN_COUNTRIES.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        role="option"
                        aria-selected={phoneCountry === country.code}
                        onClick={() => {
                          setPhoneCountry(country.code);
                          setCountryMenuOpen(false);
                          setEditForm((f) => ({ ...f, phone: localPhone.trim() ? `${country.dialCode}${localPhone.replace(/\s/g, "")}` : "" }));
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${phoneCountry === country.code ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50"}`}
                      >
                        <CountryFlag code={country.code} name={country.name} />
                        <span>{country.dialCode}</span>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  value={localPhone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9\s]/g, "");
                    setLocalPhone(value);
                    const country = AFRICAN_COUNTRIES.find((item) => item.code === phoneCountry) || AFRICAN_COUNTRIES[0];
                    setEditForm((f) => ({ ...f, phone: value.trim() ? `${country.dialCode}${value.replace(/\s/g, "")}` : "" }));
                  }}
                  disabled={saving}
                  required
                  className="min-w-0 flex-1 rounded-r-xl bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Adresse</label>
              <Input value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} disabled={saving} />
            </div>
          </div>

          {editError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {editError}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditMode(false); setEditError(null); }} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Associate Dialog */}
      <Dialog
        open={assocOpen}
        onOpenChange={(val) => { if (!val && !assocLoading) { setAssocOpen(false); setAssocChildren([]); setAssocError(null); } }}
      >
        <DialogContent className="h-[min(640px,calc(100vh-2rem))] sm:max-w-[620px] max-h-[calc(100vh-2rem)] overflow-hidden p-0">
          <div className="flex h-full min-h-0 flex-col">
            <div className="px-6 pb-3 pt-6">
              <DialogHeader className="space-y-2">
                <DialogTitle className="flex items-center gap-2 text-left">
                  <Plus className="h-5 w-5 text-primary" />
                  Associer un enfant
                </DialogTitle>
                <DialogDescription className="text-left">
                  Recherchez et sélectionnez les élèves à associer à{" "}
                  <strong>{fullName}</strong>.
                </DialogDescription>
              </DialogHeader>
            </div>

            {assocError && (
              <div className="mx-6 mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{assocError}</span>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <StudentSearchSelect
                parentId={parent.id}
                selectedChildren={assocChildren}
                onSelectionChange={setAssocChildren}
                disabled={assocLoading}
              />
            </div>

            <DialogFooter className="mx-0 mb-0 gap-2 border-t border-slate-200 bg-slate-50/60 px-6 py-4">
              <Button
                variant="outline"
                onClick={() => { setAssocOpen(false); setAssocChildren([]); setAssocError(null); }}
                disabled={assocLoading}
              >
                Annuler
              </Button>
              <Button
                onClick={handleAssociate}
                disabled={assocLoading || assocChildren.length === 0}
              >
                {assocLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Association…</>
                ) : (
                  `Associer ${assocChildren.length > 0 ? `(${assocChildren.length})` : ""}`
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Confirm Dialog */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(val) => { if (!val && !removeLoading) setRemoveTarget(null); }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Retirer l'association
            </DialogTitle>
            <DialogDescription className="pt-1 leading-relaxed">
              Vous êtes sur le point de retirer l'association entre{" "}
              <strong>{fullName}</strong> et{" "}
              <strong>
                {removeTarget?.student.last_name} {removeTarget?.student.first_name}
              </strong>
              .<br /><br />
              <strong>Important :</strong> Cette action ne supprime ni le parent, ni l'élève,
              ni leur historique. L'élève sera simplement sans parent/tuteur actif.
            </DialogDescription>
          </DialogHeader>
          {removeError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {removeError}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removeLoading}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleRemoveAssociation} disabled={removeLoading}>
              {removeLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Traitement…</>
              ) : (
                "Retirer l'association"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 gap-2">
      <span className="text-xs text-slate-500 font-medium shrink-0">{label}</span>
      <span className="text-xs text-slate-900 font-semibold text-right">{value}</span>
    </div>
  );
}

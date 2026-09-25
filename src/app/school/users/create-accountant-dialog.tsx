"use client";

import { useState } from "react";
import { createAccountant } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, UserCheck, Mail, Phone, Building2, ShieldCheck } from "lucide-react";

interface CreateAccountantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateAccountantDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateAccountantDialogProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // État de la confirmation après création
  const [createdSummary, setCreatedSummary] = useState<{
    full_name: string;
    email: string;
    phone: string;
    role: string;
    school_name: string;
    status: string;
  } | null>(null);

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setError(null);
    setCreatedSummary(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Le nom complet est obligatoire.");
      return;
    }
    if (!phone.trim()) {
      setError("Le numéro de téléphone est obligatoire.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Une adresse email valide est obligatoire.");
      return;
    }

    setLoading(true);

    const res = await createAccountant({
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Une erreur s'est produite.");
    } else if (res.accountant) {
      setCreatedSummary(res.accountant);
      if (onSuccess) onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-5 overflow-hidden">
        {!createdSummary ? (
          <>
            <DialogHeader className="pb-1">
              <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
                <UserCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                Ajouter un Comptable
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Saisissez les coordonnées du comptable pour lui envoyer une invitation.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-3 py-1">
              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Nom complet *</label>
                <Input
                  placeholder="Ex: Benoît Kasongo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Adresse Email *</label>
                <Input
                  type="email"
                  placeholder="Ex: comptable@ecole.cd"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Numéro de téléphone *</label>
                <Input
                  placeholder="Ex: +243990000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={loading}>
                  Annuler
                </Button>
                <Button type="submit" size="sm" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Créer et Inviter
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader className="text-center pb-1">
              <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-1">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <DialogTitle className="text-base font-bold text-emerald-800">
                Comptable créé avec succès !
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                Une invitation par email a été envoyée pour la première connexion.
              </DialogDescription>
            </DialogHeader>

            <div className="my-2 p-3 bg-slate-50/90 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-medium">Nom complet</span>
                <span className="font-bold text-slate-900">{createdSummary.full_name}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Mail className="h-3 w-3 text-slate-400" /> Email
                </span>
                <span className="font-mono text-slate-800">{createdSummary.email}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400" /> Téléphone
                </span>
                <span className="font-mono text-slate-800">{createdSummary.phone}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-slate-400" /> Rôle
                </span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                  {createdSummary.role}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-slate-400" /> Établissement
                </span>
                <span className="font-medium text-slate-800">{createdSummary.school_name}</span>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-slate-500 font-medium">Statut</span>
                <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                  {createdSummary.status}
                </span>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button 
                onClick={handleClose} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-9 text-xs"
              >
                Fermer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

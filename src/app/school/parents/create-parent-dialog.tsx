"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, Loader2, AlertCircle, Info, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createParent } from "./actions";
import { StudentSearchSelect, type SelectedChild } from "./student-search-select";
import { PHONE_LENGTH_BY_COUNTRY, validateLocalPhoneForCountry } from "./phone-utils";
import { AFRICAN_COUNTRIES, CountryFlag } from "@/components/shared/phone-input";

interface CreateParentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (parentId: string) => void;
}

export function CreateParentDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateParentDialogProps) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [localPhone, setLocalPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("CD");
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [selectedChildren, setSelectedChildren] = useState<SelectedChild[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [resultFlow, setResultFlow] = useState<{
    type: "cross_tenant_consent";
    existingTenants: string[];
    consentUrl: string;
    parentName: string;
  } | null>(null);

  useEffect(() => {
    if (error) {
      formRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [error]);

  function resetForm() {
    setForm({ full_name: "", phone: "", email: "", address: "" });
    setLocalPhone("");
    setPhoneCountry("CD");
    setCountryMenuOpen(false);
    setSelectedChildren([]);
    setError(null);
    setResultFlow(null);
  }

  function handleClose(val: boolean) {
    if (!val && !submitting) {
      resetForm();
      onOpenChange(false);
    } else if (val) {
      onOpenChange(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResultFlow(null);

    if (!form.full_name.trim()) {
      setError("Le nom complet est requis.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Le téléphone est requis.");
      return;
    }
    const selectedCountry = AFRICAN_COUNTRIES.find((country) => country.code === phoneCountry) || AFRICAN_COUNTRIES[0];
    if (!validateLocalPhoneForCountry(selectedCountry.code, localPhone)) {
      setError(`Le numéro doit contenir exactement ${PHONE_LENGTH_BY_COUNTRY[selectedCountry.code] ?? 9} chiffres pour ${selectedCountry.name}.`);
      return;
    }
    if (!form.email.trim()) {
      setError("L'email est requis.");
      return;
    }

    setSubmitting(true);

    // UUID regex — filter out any corrupted entries before sending to server
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validChildren = selectedChildren.filter(
      (c) => c.student?.id && UUID_RE.test(c.student.id)
    );
    if (validChildren.length < selectedChildren.length) {
      setError("Un élève sélectionné est invalide. Retirez-le et choisissez-le à nouveau.");
      setSubmitting(false);
      return;
    }

    try {
      const result = await createParent({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim() || null,
        children: validChildren.map((c) => ({
          student_id: c.student.id,
          relationship: c.relationship,
        })),
      });

      if (!result.success) {
        setError(result.error || "Une erreur est survenue.");
        return;
      }

      if (result.flow === "cross_tenant_consent") {
        // Show the secure cross-tenant consent notice — do NOT close yet
        setResultFlow({
          type: "cross_tenant_consent",
          existingTenants: result.existingTenants || [],
          consentUrl: result.consentUrl || "",
          parentName: form.full_name.trim(),
        });
        onCreated(result.parentId!);
        return;
      }

      // Standard flow: invitation sent, close dialog
      onCreated(result.parentId!);
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Erreur inattendue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[min(760px,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="shrink-0 border-b bg-slate-50/80 px-6 py-5 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Ajouter un parent / tuteur
          </DialogTitle>
        </DialogHeader>

        <form
          id="create-parent-form"
          ref={formRef}
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6"
        >
          {/* Error */}
          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Cross-tenant consent notice — displayed INSTEAD of the form */}
          {resultFlow?.type === "cross_tenant_consent" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Info className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-semibold text-blue-900">
                    Ce parent a déjà un compte Paylix.
                  </p>
                  <p className="text-sm text-blue-800">
                    Envoyez ce lien pour qu’il valide l’accès à cet établissement.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Lien d’invitation
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <code className="flex-1 break-all text-xs text-slate-700">
                    {resultFlow.consentUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(resultFlow.consentUrl)}
                    className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    Copier
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                Le lien expire dans 7 jours. Le parent reste en statut <strong>Invité</strong>
                jusqu’à son acceptation.
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setResultFlow(null);
                  resetForm();
                  onOpenChange(false);
                }}
              >
                Fermer
              </Button>
            </div>
          )}

          {!resultFlow && (
            <>
              <fieldset className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="cp-full-name" className="text-xs font-medium text-slate-700">
                    Nom complet *
                  </label>
                  <Input
                    id="cp-full-name"
                    placeholder="Ex : Marie Kabila Mutombo"
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    disabled={submitting}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="cp-phone" className="text-xs font-medium text-slate-700">
                    Téléphone *
                  </label>
                  <div className="relative flex h-11 overflow-visible rounded-xl border border-slate-200 bg-white shadow-xs transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                    <label className="flex items-center border-r border-slate-200 bg-emerald-50/60 px-2">
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Pays et indicatif"
                          aria-expanded={countryMenuOpen}
                          disabled={submitting}
                          onClick={() => setCountryMenuOpen((open) => !open)}
                          className="flex h-10 items-center gap-1.5 rounded-lg px-1.5 text-sm font-medium text-slate-700 outline-none hover:bg-emerald-100/70 focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-60"
                        >
                          <CountryFlag
                            code={AFRICAN_COUNTRIES.find((country) => country.code === phoneCountry)?.code || "CD"}
                            name={AFRICAN_COUNTRIES.find((country) => country.code === phoneCountry)?.name || "RDC"}
                          />
                          <span>{AFRICAN_COUNTRIES.find((country) => country.code === phoneCountry)?.dialCode}</span>
                          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
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
                                  setForm((f) => ({ ...f, phone: localPhone.trim() ? `${country.dialCode}${localPhone.replace(/\s/g, "")}` : "" }));
                                }}
                                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${phoneCountry === country.code ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50"}`}
                              >
                                <CountryFlag code={country.code} name={country.name} />
                                <span>{country.dialCode}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                    <input
                      id="cp-phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="81 000 0000"
                      value={localPhone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9\s]/g, "");
                        setLocalPhone(value);
                        const country = AFRICAN_COUNTRIES.find((item) => item.code === phoneCountry) || AFRICAN_COUNTRIES[0];
                        const digits = value.replace(/\s/g, "");
                        setForm((f) => ({ ...f, phone: value.trim() ? `${country.dialCode}${digits}` : "" }));
                      }}
                      disabled={submitting}
                      required
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="cp-email" className="text-xs font-medium text-slate-700">
                    Email *
                  </label>
                  <Input
                    id="cp-email"
                    type="email"
                    placeholder="parent@exemple.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    disabled={submitting}
                    required
                  />
                </div>
              </fieldset>
            </>
          )}
        </form>

        {!resultFlow && (
          <DialogFooter className="mx-0 mb-0 shrink-0 flex items-center justify-end gap-3 rounded-none border-t bg-white px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={submitting}
              className="w-full min-w-[120px] rounded-xl border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form="create-parent-form"
              disabled={submitting}
              className="w-full min-w-[170px] rounded-xl bg-[#1d8b6a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#177a5f] disabled:opacity-70 sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création en cours…
                </>
              ) : (
                "Créer le parent"
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

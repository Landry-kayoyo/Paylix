"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CrossTenantInvitation } from "./actions";
import { acceptCrossTenantInvitation, declineCrossTenantInvitation } from "./actions";

interface JoinConsentClientProps {
  invitation: CrossTenantInvitation;
  isAuthenticated: boolean;
  isCorrectUser: boolean;
}

export function JoinConsentClient({
  invitation,
  isAuthenticated,
  isCorrectUser,
}: JoinConsentClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<"loading" | "unauthenticated" | "correct" | "wrong">(
    isAuthenticated ? (isCorrectUser ? "correct" : "wrong") : "loading"
  );

  useEffect(() => {
    let mounted = true;

    const resolveSession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session?.user) {
        setAuthState("unauthenticated");
      } else {
        setAuthState(session.user.id === invitation.auth_user_id ? "correct" : "wrong");
      }
    };

    resolveSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setAuthState("unauthenticated");
      } else {
        setAuthState(session.user.id === invitation.auth_user_id ? "correct" : "wrong");
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [invitation.auth_user_id, router, supabase.auth]);

  const isAuthenticatedNow = authState === "correct" || authState === "wrong";
  const isCorrectUserNow = authState === "correct";

  function handleAccept() {
    startTransition(async () => {
      const res = await acceptCrossTenantInvitation(invitation.id, invitation.token);
      if (res.success) {
        setResult("accepted");
        // Redirect to the parent portal showing the newly accepted establishment
        setTimeout(() => {
          router.push(`/parent?tenant=${invitation.tenant_id}`);
        }, 2000);
      } else {
        setError(res.error || "Une erreur est survenue.");
      }
    });
  }

  function handleDecline() {
    startTransition(async () => {
      const res = await declineCrossTenantInvitation(invitation.id, invitation.token);
      if (res.success) {
        setResult("declined");
      } else {
        setError(res.error || "Une erreur est survenue.");
      }
    });
  }

  // ── Result screens ────────────────────────────────────────────────────────────

  if (result === "accepted") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                Accès autorisé !
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Vous avez autorisé l'accès de votre compte à{" "}
                <strong>{invitation.tenant.name}</strong>. Vous pouvez maintenant
                switcher entre vos établissements depuis votre portail.
              </p>
            </div>
            <Button
              className="w-full mt-2"
              onClick={() => router.push("/parent")}
            >
              Accéder à mon portail
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result === "declined") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                Invitation refusée
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Vous avez refusé l'accès de votre compte à{" "}
                <strong>{invitation.tenant.name}</strong>. Aucune donnée n'a été
                partagée. Si c'est une erreur, contactez l'établissement.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main consent screen ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-5">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
              <ShieldCheck className="h-7 w-7" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Autorisation d'accès
          </h1>
          <p className="text-sm text-slate-500">
            Un établissement souhaite associer votre compte Paylix
          </p>
        </div>

        {/* Establishment card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
                <Building2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-base">
                  {invitation.tenant.name}
                </p>
                {invitation.tenant.city && (
                  <p className="text-xs text-slate-500">{invitation.tenant.city}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-100">
              <Row label="Invité en tant que" value="Parent / Tuteur" />
              <Row
                label="Inscrit par"
                value={invitation.invited_by_name || "L'administration"}
              />
              
              <Row
                label="Expire le"
                value={new Date(invitation.expires_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security notice */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 leading-relaxed">
            <strong>Sécurité :</strong> En acceptant, vous autorisez cet établissement à
            consulter les informations scolaires de votre enfant. Votre compte Paylix reste{" "}
            <strong>unique</strong> — vous pourrez switcher entre vos établissements depuis
            votre portail. Vous pouvez refuser à tout moment.
          </div>
        </div>

        {/* Not authenticated warning */}
        {!isAuthenticatedNow && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <strong>Connexion requise.</strong> Vous devez vous connecter avec votre compte
              Paylix pour accepter cette invitation.
            </div>
          </div>
        )}

        {isAuthenticatedNow && !isCorrectUserNow && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 leading-relaxed">
              <strong>Mauvais compte.</strong> Cette invitation est destinée à{" "}
              <strong>{invitation.parent.email}</strong>. Connectez-vous avec le bon compte.
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Actions */}
        {!isAuthenticatedNow ? (
          <Button
            className="w-full gap-2"
            onClick={() =>
              router.push(
                `/login?next=/parent/join?token=${invitation.token}`
              )
            }
          >
            <LogIn className="h-4 w-4" />
            Se connecter pour répondre
          </Button>
        ) : isCorrectUserNow ? (
          <div className="flex flex-col gap-3">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
              onClick={handleAccept}
              disabled={isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isPending ? "Traitement…" : "Autoriser l'accès"}
            </Button>
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50 gap-2"
              onClick={handleDecline}
              disabled={isPending}
            >
              <XCircle className="h-4 w-4" />
              Refuser
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 text-center">
            Cette invitation est destinée à <strong>{invitation.parent.email}</strong>.
            <br />
            Connectez-vous avec le bon compte Paylix.
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          Paylix · Gestion scolaire sécurisée
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInvitationByToken } from "./actions";
import { JoinConsentClient } from "./consent-client";

export const metadata = {
  title: "Invitation Paylix | Autorisation d'accès",
};

export default async function JoinConsentPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams.token;

  if (!token) {
    redirect("/");
  }

  const { invitation, error } = await getInvitationByToken(token);

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-6 text-center border border-red-100">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-xl font-bold">!</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Invitation non valide</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  // Check auth status
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthenticated = !!user;
  const isCorrectUser = isAuthenticated ? user.id === invitation.auth_user_id : false;

  return (
    <JoinConsentClient
      invitation={invitation}
      isAuthenticated={isAuthenticated}
      isCorrectUser={isCorrectUser}
    />
  );
}

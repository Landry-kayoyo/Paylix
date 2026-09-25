import { Metadata } from "next";
import { getMyProfile } from "@/app/actions/account";
import { AvatarUpload } from "@/components/shared/avatar-upload";
import { UpdateProfileForm } from "@/components/account/update-profile-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { AlertTriangle, Mail, User, Lock, Building2 } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Mon Compte | Paylix",
  description: "Gérer vos informations personnelles et paramètres de sécurité.",
};

import { cookies } from "next/headers";
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/lib/sidebar-state";

export default async function AccountPage() {
  const profile = await getMyProfile();
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_STORAGE_KEY)?.value === "true";
  
  const userRole = (profile.role as "platform_admin" | "director" | "accountant" | "parent") || "parent";

  return (
    <PageContainer title="Mon Compte" role={userRole} profile={profile} initialCollapsed={initialCollapsed}>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-gray-500 mt-1">
            Gérez vos informations personnelles et paramètres de sécurité.
          </p>
        </div>

        {/* Section 1: Photo de profil */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Photo de profil</h2>
              <p className="text-sm text-gray-500">Votre avatar visible par l'équipe</p>
            </div>
          </div>
          <div className="p-6">
            <AvatarUpload
              currentAvatarUrl={profile.avatarUrl}
              firstName={profile.firstName}
              lastName={profile.lastName}
            />
          </div>
        </div>

        {/* Section 2: Informations personnelles */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Informations personnelles</h2>
              <p className="text-sm text-gray-500">Votre nom et vos coordonnées</p>
            </div>
          </div>
          <div className="p-6">
            <UpdateProfileForm
              initialData={{
                firstName: profile.firstName,
                lastName: profile.lastName,
                postName: profile.postName,
                phone: profile.phone,
              }}
            />
          </div>
        </div>

        {/* Section 3: Adresse E-mail */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Adresse E-mail</h2>
              <p className="text-sm text-gray-500">Votre e-mail de connexion</p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-medium text-gray-900">{profile.email}</p>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Changement d'e-mail</p>
                <p className="mt-1">
                  Le changement d'adresse e-mail est désactivé pour le moment. Veuillez contacter le support technique si vous devez modifier votre e-mail de connexion.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Mot de passe */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Mot de passe</h2>
              <p className="text-sm text-gray-500">Sécurisez votre compte</p>
            </div>
          </div>
          <div className="p-6">
            <ChangePasswordForm />
          </div>
        </div>

        {/* Section 5: Établissement / Plateforme */}
        {userRole === "platform_admin" ? (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Administration Plateforme</h2>
                <p className="text-sm text-gray-500">Votre rôle sur la plateforme SaaS</p>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Plateforme</p>
                  <p className="font-medium text-gray-900">Paylix</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rôle</p>
                  <p className="font-medium text-emerald-700 capitalize">Administrateur SaaS</p>
                </div>
              </div>
            </div>
          </div>
        ) : profile.tenant ? (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Établissement</h2>
                <p className="text-sm text-gray-500">Votre établissement rattaché</p>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Nom de l'établissement</p>
                  <p className="font-medium text-gray-900">{profile.tenant.name}</p>
                </div>
                {profile.tenant.city && (
                  <div>
                    <p className="text-sm text-gray-500">Ville</p>
                    <p className="font-medium text-gray-900">{profile.tenant.city}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Rôle</p>
                  <p className="font-medium text-gray-900 capitalize">{userRole}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}

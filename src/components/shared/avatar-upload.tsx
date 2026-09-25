"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadProfileImage, deleteProfileImage } from "@/app/actions/account";
import { Upload, Trash2, Loader2 } from "lucide-react";
import Image from "next/image";

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  firstName: string;
  lastName: string;
}

// Default human avatar SVG (inline)
function DefaultAvatar({ initials }: { initials: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="50" fill="url(#grad)" />
      {/* Head */}
      <circle cx="50" cy="38" r="16" fill="white" fillOpacity="0.9" />
      {/* Body */}
      <ellipse cx="50" cy="78" rx="24" ry="18" fill="white" fillOpacity="0.9" />
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#065f46" />
        </linearGradient>
      </defs>
      {/* Initials overlay */}
      <text
        x="50"
        y="44"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#065f46"
      >
        {initials}
      </text>
    </svg>
  );
}

export function AvatarUpload({ currentAvatarUrl, firstName, lastName }: AvatarUploadProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      setError("Format non accepté. Utilisez JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Le fichier est trop volumineux (max 5 MB).");
      return;
    }

    // Show preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    setError(null);
    setSuccess(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadProfileImage(formData);
      if (result.success && result.avatarUrl) {
        setSuccess("Photo de profil mise à jour.");
        setPreviewUrl(result.avatarUrl);
        // Refresh to update the header avatar too
        router.refresh();
      } else {
        setError(result.error || "Erreur lors de l'upload.");
        setPreviewUrl(currentAvatarUrl ?? null); // revert preview
      }
    } catch (err) {
      setError("Erreur inattendue. Veuillez réessayer.");
      setPreviewUrl(currentAvatarUrl ?? null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!confirm("Voulez-vous vraiment supprimer votre photo de profil ?")) return;

    setError(null);
    setSuccess(null);
    setIsUploading(true);

    try {
      const result = await deleteProfileImage();
      if (result.success) {
        setSuccess("Photo de profil supprimée.");
        setPreviewUrl(null);
        router.refresh();
      } else {
        setError(result.error || "Erreur lors de la suppression.");
      }
    } catch (err) {
      setError("Erreur inattendue.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-6">
      {/* Avatar Circle */}
      <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-primary/20 shadow-sm shrink-0">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={`${firstName} ${lastName}`}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <DefaultAvatar initials={initials} />
        )}
        {/* Loading overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>Changer la photo</span>
          </button>

          {previewUrl && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isUploading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 bg-red-50 text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>Supprimer</span>
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500">JPEG, PNG ou WebP — 5 MB maximum.</p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-md">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-md">{success}</p>
        )}
      </div>
    </div>
  );
}

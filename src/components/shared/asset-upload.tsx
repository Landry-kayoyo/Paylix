"use client";

import { useState, useRef } from "react";
import { uploadTenantAsset } from "@/app/school/settings/actions";
import { Upload, Loader2, Image as ImageIcon } from "lucide-react";
import Image from "next/image";

interface AssetUploadProps {
  currentUrl?: string | null;
  type: "logo" | "signature" | "stamp";
  label: string;
  description?: string;
}

export function AssetUpload({ currentUrl, type, label, description }: AssetUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    try {
      const result = await uploadTenantAsset(formData);
      if (result.success && result.url) {
        setSuccess("Fichier mis à jour avec succès.");
        setPreviewUrl(result.url); // Use the new public URL
      } else {
        setError(result.error || "Erreur lors de l'upload.");
      }
    } catch (err) {
      setError("Erreur inattendue.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex items-start space-x-6">
      <div className="relative h-20 w-32 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={label}
            fill
            className="object-contain"
            unoptimized
          />
        ) : (
          <ImageIcon className="w-8 h-8 text-gray-400" />
        )}
        {isUploading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="space-y-2 flex-1">
        <div>
          <h4 className="font-medium text-gray-900">{label}</h4>
          {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
        
        <div className="flex items-center space-x-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn btn-secondary text-sm flex items-center space-x-2 py-1.5 px-3"
          >
            <Upload className="w-4 h-4" />
            <span>Choisir un fichier</span>
          </button>
        </div>
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
      </div>
    </div>
  );
}

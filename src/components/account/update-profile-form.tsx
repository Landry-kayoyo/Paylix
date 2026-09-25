"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateMyProfile } from "@/app/actions/account";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const updateProfileSchema = z.object({
  firstName: z.string().min(1, "Le prénom est obligatoire.").max(100),
  lastName: z.string().min(1, "Le nom est obligatoire.").max(100),
  postName: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
});

type UpdateProfileData = z.infer<typeof updateProfileSchema>;

interface UpdateProfileFormProps {
  initialData: {
    firstName: string;
    lastName: string;
    postName?: string | null;
    phone?: string | null;
  };
}

export function UpdateProfileForm({ initialData }: UpdateProfileFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: initialData.firstName,
      lastName: initialData.lastName,
      postName: initialData.postName || "",
      phone: initialData.phone || "",
    },
  });

  useEffect(() => {
    reset({
      firstName: initialData.firstName,
      lastName: initialData.lastName,
      postName: initialData.postName || "",
      phone: initialData.phone || "",
    });
  }, [initialData, reset]);

  const onSubmit = async (data: UpdateProfileData) => {
    setError(null);

    try {
      const result = await updateMyProfile({
        ...data,
      });

      if (result.success) {
        setIsOpen(false);
      } else {
        setError(result.error || "Une erreur est survenue.");
      }
    } catch (err) {
      setError("Erreur inattendue.");
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-sm text-gray-500">Prénom</p>
          <p className="font-medium text-gray-900">{initialData.firstName}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Nom</p>
          <p className="font-medium text-gray-900">{initialData.lastName}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Post-nom</p>
          <p className="font-medium text-gray-900">{initialData.postName || "-"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Téléphone</p>
          <p className="font-medium text-gray-900">{initialData.phone || "-"}</p>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger render={<Button variant="outline">Modifier les informations</Button>} />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier les informations</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <Input
                  id="firstName"
                  type="text"
                  {...register("firstName")}
                />
                {errors.firstName && (
                  <p className="text-sm text-red-500">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Nom <span className="text-red-500">*</span>
                </label>
                <Input
                  id="lastName"
                  type="text"
                  {...register("lastName")}
                />
                {errors.lastName && (
                  <p className="text-sm text-red-500">{errors.lastName.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="postName" className="block text-sm font-medium text-gray-700">
                  Post-nom
                </label>
                <Input
                  id="postName"
                  type="text"
                  {...register("postName")}
                />
                {errors.postName && (
                  <p className="text-sm text-red-500">{errors.postName.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Téléphone
                </label>
                <Input
                  id="phone"
                  type="text"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-sm text-red-500">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-w-[140px] bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enregistrement...</span>
                  </span>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

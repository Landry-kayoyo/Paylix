"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

async function getDirectorTenant() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("role", "director")
    .eq("status", "active")
    .single();

  if (!membership || !membership.tenant_id) {
    throw new Error("Accès refusé : espace réservé aux directeurs d'établissement.");
  }

  return { supabase, user, tenantId: membership.tenant_id };
}

export interface SchoolYearItem {
  id: string;
  tenant_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "preparation" | "active" | "archived";
  created_at: string;
  updated_at: string;
  classCount: number;
}

export async function getSchoolYears(): Promise<SchoolYearItem[]> {
  const { supabase, tenantId } = await getDirectorTenant();

  const { data: years, error } = await supabase
    .from("school_years")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("start_date", { ascending: false });

  if (error) throw new Error(`Erreur lors de la récupération des années scolaires: ${error.message}`);

  // Fetch count of classes for each school year via class_school_years
  const { data: classLinks } = await supabase
    .from("class_school_years")
    .select("school_year_id")
    .eq("tenant_id", tenantId);

  const countMap = new Map<string, number>();
  classLinks?.forEach(link => {
    countMap.set(link.school_year_id, (countMap.get(link.school_year_id) || 0) + 1);
  });

  return (years || []).map(y => ({
    ...y,
    status: y.status as "preparation" | "active" | "archived",
    classCount: countMap.get(y.id) || 0,
  }));
}

const createYearSchema = z.object({
  name: z.string().min(2, "Le nom de l'année scolaire est requis"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date début invalide (YYYY-MM-DD)"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date fin invalide (YYYY-MM-DD)"),
  status: z.enum(["preparation", "active", "archived"]).default("preparation"),
}).refine(data => new Date(data.end_date) > new Date(data.start_date), {
  message: "La date de fin doit être postérieure à la date de début",
  path: ["end_date"],
});

export async function createSchoolYear(data: z.infer<typeof createYearSchema>) {
  const { supabase, tenantId } = await getDirectorTenant();
  const validated = createYearSchema.parse(data);

  try {
    // If set to active, archive any current active year first
    if (validated.status === "active") {
      await supabase
        .from("school_years")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("status", "active");
    }

    const { data: newYear, error } = await supabase
      .from("school_years")
      .insert({
        tenant_id: tenantId,
        name: validated.name,
        start_date: validated.start_date,
        end_date: validated.end_date,
        status: validated.status,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/school/years");
    return { success: true, year: newYear };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function activateSchoolYear(yearId: string) {
  const { supabase, tenantId } = await getDirectorTenant();

  try {
    // 1. Archive currently active school year
    await supabase
      .from("school_years")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    // 2. Activate target school year
    const { data: activated, error } = await supabase
      .from("school_years")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", yearId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/school/years");
    revalidatePath("/school/classes");
    return { success: true, year: activated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function archiveSchoolYear(yearId: string) {
  const { supabase, tenantId } = await getDirectorTenant();

  try {
    const { data: archived, error } = await supabase
      .from("school_years")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", yearId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/school/years");
    return { success: true, year: archived };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

const updateYearSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(data => new Date(data.end_date) > new Date(data.start_date), {
  message: "La date de fin doit être postérieure à la date de début",
  path: ["end_date"],
});

export async function updateSchoolYear(data: z.infer<typeof updateYearSchema>) {
  const { supabase, tenantId } = await getDirectorTenant();
  const validated = updateYearSchema.parse(data);

  try {
    const { data: updated, error } = await supabase
      .from("school_years")
      .update({
        name: validated.name,
        start_date: validated.start_date,
        end_date: validated.end_date,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", validated.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/school/years");
    return { success: true, year: updated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function closeAndPrepareNextYear(activeYearId: string, nextYearData: { name: string, start_date: string, end_date: string }) {
  const { supabase, tenantId } = await getDirectorTenant();

  try {
    // 1. Verify active year
    const { data: activeYear } = await supabase
      .from("school_years")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("id", activeYearId)
      .eq("status", "active")
      .single();

    if (!activeYear) throw new Error("L'année spécifiée n'est pas l'année active.");

    // 2. Fetch classes from the active year
    const { data: currentClasses } = await supabase
      .from("class_school_years")
      .select("class_id")
      .eq("tenant_id", tenantId)
      .eq("school_year_id", activeYearId);

    // 3. Create the new year in "preparation"
    const { data: newYear, error: newYearError } = await supabase
      .from("school_years")
      .insert({
        tenant_id: tenantId,
        name: nextYearData.name,
        start_date: nextYearData.start_date,
        end_date: nextYearData.end_date,
        status: "preparation",
      })
      .select()
      .single();

    if (newYearError) throw new Error(newYearError.message);

    // 4. Archive the current year
    const { error: archiveError } = await supabase
      .from("school_years")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", activeYearId)
      .eq("tenant_id", tenantId);

    if (archiveError) throw new Error(archiveError.message);

    // 5. Copy classes to the new year
    if (currentClasses && currentClasses.length > 0) {
      const classLinksToInsert = currentClasses.map(c => ({
        tenant_id: tenantId,
        school_year_id: newYear.id,
        class_id: c.class_id,
      }));

      const { error: linkError } = await supabase
        .from("class_school_years")
        .insert(classLinksToInsert);

      if (linkError) throw new Error(linkError.message);
    }

    revalidatePath("/school/years");
    revalidatePath("/school/classes");
    return { success: true, newYear, copiedClassesCount: currentClasses?.length || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

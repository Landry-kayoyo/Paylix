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

export interface ClassItem {
  id: string;
  tenant_id: string;
  name: string;
  status: "active" | "inactive";
  created_at: string;
}

export interface SchoolYearSimple {
  id: string;
  name: string;
  status: "preparation" | "active" | "archived";
  start_date: string;
  end_date: string;
}

export interface ClassYearLink {
  id: string;
  class_id: string;
  school_year_id: string;
}

export async function getClassesData() {
  const { supabase, tenantId } = await getDirectorTenant();

  // 1. Fetch permanent classes
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (classesError) throw new Error(`Erreur lors de la récupération des classes: ${classesError.message}`);

  // 2. Fetch school years
  const { data: years, error: yearsError } = await supabase
    .from("school_years")
    .select("id, name, status, start_date, end_date")
    .eq("tenant_id", tenantId)
    .order("start_date", { ascending: false });

  if (yearsError) throw new Error(`Erreur lors de la récupération des années: ${yearsError.message}`);

  // 3. Fetch junction links
  const { data: links, error: linksError } = await supabase
    .from("class_school_years")
    .select("id, class_id, school_year_id")
    .eq("tenant_id", tenantId);

  if (linksError) throw new Error(`Erreur lors de la récupération des associations: ${linksError.message}`);

  return {
    classes: (classes || []).map(c => ({
      ...c,
      status: (c.status || "active") as "active" | "inactive",
    })),
    years: (years || []) as SchoolYearSimple[],
    links: (links || []) as ClassYearLink[],
  };
}

const createClassSchema = z.object({
  name: z.string().min(2, "Le nom de la classe est requis"),
  status: z.enum(["active", "inactive"]).default("active"),
  associateWithYearId: z.string().uuid().optional(),
});

const createClassesBulkSchema = z.object({
  names: z.string().min(2, "Ajoutez au moins un nom de classe"),
  status: z.enum(["active", "inactive"]).default("active"),
  associateWithYearId: z.string().uuid().optional(),
});

export async function createClass(data: z.infer<typeof createClassSchema>) {
  const { supabase, tenantId } = await getDirectorTenant();
  const validated = createClassSchema.parse(data);

  try {
    // 1. Insert permanent class
    const { data: newClass, error: classError } = await supabase
      .from("classes")
      .insert({
        tenant_id: tenantId,
        name: validated.name,
        status: validated.status,
      })
      .select()
      .single();

    if (classError) throw new Error(classError.message);

    // 2. Associate with school year if requested
    if (validated.associateWithYearId) {
      const { error: linkError } = await supabase
        .from("class_school_years")
        .insert({
          tenant_id: tenantId,
          class_id: newClass.id,
          school_year_id: validated.associateWithYearId,
        });

      if (linkError) {
        console.error("Link error:", linkError);
      }
    }

    revalidatePath("/school/classes");
    revalidatePath("/school/years");
    return { success: true, class: newClass };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createClassesBulk(data: z.infer<typeof createClassesBulkSchema>) {
  const { supabase, tenantId } = await getDirectorTenant();
  const validated = createClassesBulkSchema.parse(data);
  const names = [...new Map(
    validated.names
      .split(/[\n,;]+/)
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => [name.toLowerCase(), name] as const)
  ).values()];

  if (names.length === 0) {
    return { success: false, error: "Ajoutez au moins un nom de classe." };
  }

  if (names.some((name) => name.length < 2)) {
    return { success: false, error: "Chaque nom de classe doit contenir au moins 2 caractères." };
  }

  try {
    const { data: existingClasses, error: existingError } = await supabase
      .from("classes")
      .select("name")
      .eq("tenant_id", tenantId);

    if (existingError) throw new Error(existingError.message);

    const existingNames = new Set((existingClasses || []).map((classItem) => classItem.name.toLowerCase()));
    const duplicateNames = names.filter((name) => existingNames.has(name.toLowerCase()));

    if (duplicateNames.length > 0) {
      return {
        success: false,
        error: `Ces classes existent déjà : ${duplicateNames.join(", ")}.`,
      };
    }

    const { data: newClasses, error: classError } = await supabase
      .from("classes")
      .insert(names.map((name) => ({
        tenant_id: tenantId,
        name,
        status: validated.status,
      })))
      .select();

    if (classError) throw new Error(classError.message);

    if (validated.associateWithYearId && newClasses?.length) {
      const { error: linkError } = await supabase
        .from("class_school_years")
        .insert(newClasses.map((classItem) => ({
          tenant_id: tenantId,
          class_id: classItem.id,
          school_year_id: validated.associateWithYearId,
        })));

      if (linkError) throw new Error(linkError.message);
    }

    revalidatePath("/school/classes");
    revalidatePath("/school/years");
    return { success: true, classes: newClasses || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

const updateClassSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  status: z.enum(["active", "inactive"]),
});

export async function updateClass(data: z.infer<typeof updateClassSchema>) {
  const { supabase, tenantId } = await getDirectorTenant();
  const validated = updateClassSchema.parse(data);

  try {
    const { data: updated, error } = await supabase
      .from("classes")
      .update({
        name: validated.name,
        status: validated.status,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", validated.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/school/classes");
    return { success: true, class: updated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleClassYearAssociation(classId: string, schoolYearId: string, associate: boolean) {
  const { supabase, tenantId } = await getDirectorTenant();

  try {
    if (associate) {
      const { error } = await supabase
        .from("class_school_years")
        .upsert({
          tenant_id: tenantId,
          class_id: classId,
          school_year_id: schoolYearId,
        }, {
          onConflict: "class_id,school_year_id"
        });

      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("class_school_years")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("class_id", classId)
        .eq("school_year_id", schoolYearId);

      if (error) throw new Error(error.message);
    }

    revalidatePath("/school/classes");
    revalidatePath("/school/years");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

import { redirect } from "next/navigation";
import { getParentById } from "../actions";
import { ParentDetailClient } from "./parent-detail-client";

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { parent } = await getParentById(params.id);
    return {
      title: `${parent.full_name} — Parents | Paylix`,
    };
  } catch {
    return { title: "Parent — Paylix" };
  }
}

export default async function ParentDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  let parent;
  let children;

  try {
    const result = await getParentById(params.id);
    parent = result.parent;
    children = result.children;
  } catch {
    redirect("/school/parents");
  }

  return (
    <ParentDetailClient
      parent={parent}
      children={children}
      initialEditMode={searchParams.edit === "true"}
    />
  );
}

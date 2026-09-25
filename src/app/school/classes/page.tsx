import { getClassesData } from "./actions";
import { ClassesClient } from "./classes-client";

export default async function SchoolClassesPage() {
  const { classes, years, links } = await getClassesData();

  return <ClassesClient initialClasses={classes} years={years} initialLinks={links} />;
}

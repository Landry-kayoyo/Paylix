import { getSchoolYears } from "./actions";
import { getClassesData } from "../classes/actions";
import { YearsClient } from "./years-client";

export default async function SchoolYearsPage() {
  const [years, { classes, links }] = await Promise.all([
    getSchoolYears(),
    getClassesData(),
  ]);

  return <YearsClient initialYears={years} classes={classes} links={links} />;
}

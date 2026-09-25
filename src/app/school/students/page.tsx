import { getStudentsData } from "./actions";
import { StudentsClient } from "./students-client";

export const metadata = {
  title: "Élèves — Paylix",
  description: "Gestion des élèves de l'établissement",
};

export default async function StudentsPage() {
  const { students, total, years, activeYear, classes } = await getStudentsData(1, 25, { status: "active" });

  return (
    <StudentsClient
      initialStudents={students}
      initialTotal={total}
      years={years}
      activeYear={activeYear}
      classes={classes}
    />
  );
}

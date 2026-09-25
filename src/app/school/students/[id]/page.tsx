import { redirect } from "next/navigation";
import { getStudentById, getEnrollmentHistory, getClassesForActiveYear, getStudentFinancialObligations } from "../actions";
import { ChevronLeft, GraduationCap, Calendar, BookOpen, ArrowRightLeft, User, FileText, CheckCircle2, History, Wallet } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StudentClassChangeDialog } from "../student-class-change-dialog";

export default async function StudentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const studentId = params.id;

  let student;
  try {
    student = await getStudentById(studentId);
  } catch (error) {
    redirect("/school/students");
  }

  if (!student) {
    redirect("/school/students");
  }

  const { activeYear, classes } = await getClassesForActiveYear();
  const enrollments = student.student_enrollments || [];
  const sortedEnrollments = [...enrollments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const currentEnrollment = sortedEnrollments[0];
  const financialObligations = await getStudentFinancialObligations(studentId);

  const historyByEnrollment = new Map<string, any[]>();
  for (const enrollment of sortedEnrollments) {
    historyByEnrollment.set(enrollment.id, await getEnrollmentHistory(enrollment.id));
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/school/students">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            {student.last_name.toUpperCase()} {student.post_name ? student.post_name + " " : ""}{student.first_name}
            {student.status === "active" ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Actif</Badge>
            ) : (
              <Badge variant="outline" className="bg-slate-100 text-slate-600">Archivé</Badge>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">{student.matricule}</Badge>
            <span>•</span>
            Inscrit le {new Date(student.created_at).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>

      <div className="w-full max-w-[980px] mr-auto space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-slate-500" />
              Informations personnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 font-medium">Nom complet</span>
              <span className="text-sm font-semibold text-slate-900">
                {student.last_name.toUpperCase()} {student.post_name ? student.post_name.toUpperCase() + " " : ""}{student.first_name}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 font-medium">Sexe</span>
              <span className="text-sm font-medium text-slate-900">
                {student.gender === "M" ? "Masculin" : "Féminin"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 font-medium">Date de naissance</span>
              <span className="text-sm font-medium text-slate-900">
                {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("fr-FR") : "Non renseignée"}
              </span>
            </div>
          </CardContent>
        </Card>

      <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="text-left">
                <CardTitle className="text-base flex items-center gap-2 justify-start">
                  <GraduationCap className="h-4 w-4 text-slate-500" />
                  Scolarité
                </CardTitle>
                <CardDescription className="text-left">
                  Historique des inscriptions et de la scolarité de l'élève.
                </CardDescription>
              </div>
              {currentEnrollment && classes.length > 0 && (
                <div className="ml-auto shrink-0">
                  <StudentClassChangeDialog
                    enrollmentId={currentEnrollment.id}
                    oldClassId={currentEnrollment.class_id}
                    studentName={`${student.first_name} ${student.last_name}`}
                    classes={classes}
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {sortedEnrollments.length > 0 ? (
              <div className="space-y-6">
                {sortedEnrollments.map((enrollment: any, idx: number) => {
                  const isLatest = idx === 0;
                  const history = historyByEnrollment.get(enrollment.id) || [];
                  return (
                    <div key={enrollment.id} className={`flex gap-4 ${!isLatest ? "opacity-70" : ""}`}>
                      <div className="flex flex-col items-center">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isLatest ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                          {isLatest ? <CheckCircle2 className="h-4 w-4" /> : <History className="h-4 w-4" />}
                        </div>
                        {idx !== sortedEnrollments.length - 1 && (
                          <div className="w-px h-full bg-slate-200 my-2"></div>
                        )}
                      </div>
                      <div className="pb-4 w-full">
                        <p className="text-sm font-semibold text-slate-900">
                          Classe de {(enrollment.classes as any)?.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          Année scolaire {(enrollment.school_years as any)?.name}
                        </p>

                        {history.length > 0 && (
                          <div className="mt-3 pl-2 border-l-2 border-slate-200 space-y-2">
                            {history.map((record: any) => (
                              <div key={record.id} className="text-xs text-slate-600">
                                <span className="font-medium text-slate-700">Changement</span> : {record.old_class?.name || "Classe précédente"} → {record.new_class?.name || "Classe cible"}
                                <span className="block text-[11px] text-slate-400">
                                  {new Date(record.changed_at).toLocaleDateString("fr-FR")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-3">
                          {isLatest ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              Inscription active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                              Inscription passée
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 rounded-xl border border-dashed border-slate-200">
                <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">Aucune inscription</p>
                <p className="text-xs text-slate-500 mt-1">Cet élève n'a pas encore été inscrit dans une classe.</p>
              </div>
            )}
          </CardContent>
        </Card>
        

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-slate-500" />
              Obligations financières
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {financialObligations.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">Aucune obligation financière pour cet élève.</div>
            ) : (
              <div className="space-y-4 p-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex flex-wrap gap-3">
                    {(['USD', 'CDF'] as const).map((currency) => {
                      const items = financialObligations.filter((obligation) => obligation.currency === currency);
                      if (items.length === 0) return null;

                      const total = items.reduce((sum, item) => sum + item.initialAmount, 0);
                      const paid = items.reduce((sum, item) => sum + item.paidAmount, 0);
                      const remaining = items.reduce((sum, item) => sum + item.remainingAmount, 0);

                      return (
                        <div key={currency} className="flex-1 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">{currency}</div>
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-slate-600">Total</span>
                            <strong className="text-slate-900">{total.toLocaleString()} {currency}</strong>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-sm mt-1">
                            <span className="text-slate-600">Payé</span>
                            <strong className="text-emerald-700">{paid.toLocaleString()} {currency}</strong>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-sm mt-1">
                            <span className="text-slate-600">Reste</span>
                            <strong className="text-amber-700">{remaining.toLocaleString()} {currency}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                
              </div>
            )}
          </CardContent>
        </Card>

        
      </div>
    </div>
  );
}

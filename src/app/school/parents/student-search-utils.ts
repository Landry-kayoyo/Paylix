export interface StudentSearchResult {
  id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  post_name: string | null;
  current_class: string | null;
  current_year: string | null;
  has_active_parent: boolean;
}

export function formatStudentResults(data: any[], parentId?: string): StudentSearchResult[] {
  return data
    .map((s) => {
      const enrollments = s.student_enrollments || [];
      const latest = enrollments[enrollments.length - 1] || null;

      const activeLinks = (s.parent_students || []).filter(
        (ps: any) => ps.ended_at === null
      );
      const hasActiveParent = activeLinks.length > 0;

      return {
        id: s.id,
        matricule: s.matricule,
        first_name: s.first_name,
        last_name: s.last_name,
        post_name: s.post_name,
        current_class: latest?.classes?.name || null,
        current_year: latest?.school_years?.name || null,
        has_active_parent: hasActiveParent,
      } as StudentSearchResult;
    })
    .filter((student) => !student.has_active_parent);
}

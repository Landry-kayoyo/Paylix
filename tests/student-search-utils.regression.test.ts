import { describe, it, expect } from 'vitest'
import { formatStudentResults } from '../src/app/school/parents/student-search-utils'

describe('formatStudentResults', () => {
  it('hides students already tied to an active parent from the search dropdown', () => {
    const data = [
      {
        id: 'student-1',
        matricule: 'M001',
        first_name: 'Alice',
        last_name: 'A',
        post_name: null,
        status: 'active',
        student_enrollments: [],
        parent_students: [{ id: 'link-1', ended_at: null, parent_id: 'parent-1' }],
      },
      {
        id: 'student-2',
        matricule: 'M002',
        first_name: 'Bob',
        last_name: 'B',
        post_name: null,
        status: 'active',
        student_enrollments: [],
        parent_students: [],
      },
    ]

    const results = formatStudentResults(data, 'parent-2')
    expect(results.map((r) => r.id)).toEqual(['student-2'])
  })
})

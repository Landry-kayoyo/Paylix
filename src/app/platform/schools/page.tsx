import { getTenantsWithDirectors } from "../actions";
import { SchoolsClient } from "./schools-client";

export default async function PlatformSchoolsPage() {
  const tenants = await getTenantsWithDirectors();

  return <SchoolsClient initialTenants={tenants} />;
}

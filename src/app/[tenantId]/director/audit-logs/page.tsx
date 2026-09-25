import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

import { getMyProfile } from "@/app/actions/account";
import { cookies } from "next/headers";
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/lib/sidebar-state";

export default async function AuditLogsPage({
  params
}: {
  params: { tenantId: string }
}) {
  const supabase = await createClient();

  // Validate director access
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("user_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", params.tenantId)
    .eq("status", "active")
    .single();

  if (!membership || membership.role !== "director") {
    redirect(`/${params.tenantId}/dashboard`);
  }
  
  const profile = await getMyProfile().catch(() => null);
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_STORAGE_KEY)?.value === "true";

  // Fetch audit logs
  // Since we rely on RLS, the director will only see their tenant's logs
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("tenant_id", params.tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  const typedLogs = (logs || []) as any[];

  if (error) {
    console.error("Error fetching audit logs", error);
  }

  return (
    <PageContainer
      title="Journal d'audit"
      role="director"
      profile={profile}
      initialCollapsed={initialCollapsed}
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Journal d'audit</h2>
            <p className="text-muted-foreground">
              Traçabilité des actions importantes réalisées dans l'établissement.
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Heure</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Ressource</TableHead>
                <TableHead>Utilisateur (Rôle)</TableHead>
                <TableHead className="text-right">Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Aucune entrée dans le journal d'audit.
                  </TableCell>
                </TableRow>
              ) : (
                typedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.created_at).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {log.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{log.resource_type}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs text-muted-foreground">{log.user_id ? log.user_id.slice(0, 8) + '...' : 'Système'}</span>
                        <span className="text-xs text-muted-foreground capitalize">{log.role || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger render={<Button variant="ghost" size="sm"><Eye className="h-4 w-4 mr-2" />Détails</Button>} />
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Détails de l'événement d'audit</DialogTitle>
                          </DialogHeader>
                          <div className="grid gap-4 py-4 text-sm">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <span className="font-semibold text-right">ID:</span>
                              <span className="col-span-3 font-mono text-xs">{log.id}</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <span className="font-semibold text-right">Action:</span>
                              <span className="col-span-3">
                                <Badge variant="secondary">{log.action_type}</Badge>
                              </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <span className="font-semibold text-right">Ressource:</span>
                              <span className="col-span-3 capitalize">{log.resource_type} ({log.resource_id})</span>
                            </div>
                            {log.reason && (
                              <div className="grid grid-cols-4 items-start gap-4">
                                <span className="font-semibold text-right">Motif:</span>
                                <span className="col-span-3 text-destructive font-medium">{log.reason}</span>
                              </div>
                            )}
                            {(log.old_values || log.new_values || log.context) && (
                              <div className="border rounded-md mt-4 p-4 bg-muted/20">
                                {log.old_values && (
                                  <div className="mb-4">
                                    <h5 className="font-semibold text-xs mb-2">Anciennes valeurs</h5>
                                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(log.old_values, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.new_values && (
                                  <div className="mb-4">
                                    <h5 className="font-semibold text-xs mb-2">Nouvelles valeurs</h5>
                                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(log.new_values, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.context && (
                                  <div>
                                    <h5 className="font-semibold text-xs mb-2">Contexte supplémentaire</h5>
                                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(log.context, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageContainer>
  );
}

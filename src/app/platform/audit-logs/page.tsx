import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";

export default async function PlatformAuditLogsPage() {
  const supabase = await createClient();

  // Validate platform admin access
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("user_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .eq("status", "active");

  const membership = (memberships ?? [])[0] ?? null;

  if (!membership) {
    redirect(`/login`);
  }

  // Fetch all audit logs across platform
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("*, tenants(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const typedLogs = (logs || []) as any[];

  if (error) {
    console.error("Error fetching platform audit logs", error);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 md:px-6">
        <h1 className="text-lg font-semibold md:text-xl flex-1 text-foreground">Administration Plateforme</h1>
        <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </header>
      <main className="flex-1 p-6">
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Journal d'audit global</h2>
              <p className="text-muted-foreground">
                Traçabilité des actions réalisées sur l'ensemble de la plateforme.
              </p>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Heure</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Ressource</TableHead>
                  <TableHead>Utilisateur (Rôle)</TableHead>
                  <TableHead className="text-right">Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Aucune entrée dans le journal d'audit.
                    </TableCell>
                  </TableRow>
                ) : (
                  typedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.created_at).toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.tenants?.name || 'Plateforme'}
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
                                <span className="font-semibold text-right">Établissement:</span>
                                <span className="col-span-3 font-medium">{log.tenants?.name || 'Système Global'}</span>
                              </div>
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
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, XCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface PaymentsPageProps {
  readOnly?: boolean;
  basePath?: string;
}

export default function PaymentsPage({ readOnly = false, basePath = '/accountant' }: PaymentsPageProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Nouveaux filtres
  const [dateFilter, setDateFilter] = useState('');
  const [accountantFilter, setAccountantFilter] = useState('');

  const supabase = createClient();

  useEffect(() => {
    async function loadPayments() {
      setLoading(true);
      // Pour une vraie appli, on filtrerait par tenant_id côté serveur (RLS le fait déjà).
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          amount,
          currency,
          payment_date,
          reference,
          status,
          payment_group_id,
          students (first_name, last_name, post_name, matricule),
          profiles:recorded_by (first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        // Grouper par payment_group_id pour les paiements multi-devises
        const groupMap = new Map<string, any>();
        const ungrouped: any[] = [];
        const typedData = data as any[];

        typedData.forEach(p => {
          if (p.payment_group_id) {
            if (groupMap.has(p.payment_group_id)) {
              const existing = groupMap.get(p.payment_group_id);
              if (!existing.amounts) {
                existing.amounts = [{ amount: existing.amount, currency: existing.currency }];
              }
              existing.amounts.push({ amount: p.amount, currency: p.currency });
            } else {
              p.amounts = [{ amount: p.amount, currency: p.currency }];
              groupMap.set(p.payment_group_id, p);
            }
          } else {
            p.amounts = [{ amount: p.amount, currency: p.currency }];
            ungrouped.push(p);
          }
        });

        // Fusionner et trier par date décroissante
        const merged = [...groupMap.values(), ...ungrouped].sort((a, b) => 
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        );
        setPayments(merged.slice(0, 50));
      }
      setLoading(false);
    }
    loadPayments();
  }, [supabase]);

  const filteredPayments = payments.filter(p => {
    const matchSearch = search === '' || 
      p.students?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.students?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.students?.post_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.students?.matricule?.toLowerCase().includes(search.toLowerCase());
      
    const matchDate = dateFilter === '' || new Date(p.payment_date).toISOString().split('T')[0] === dateFilter;
    
    const accountantName = p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}`.toLowerCase() : 'système';
    const matchAccountant = accountantFilter === '' || accountantName.includes(accountantFilter.toLowerCase());

    return matchSearch && matchDate && matchAccountant;
  });

  const uniqueAccountants = Array.from(new Set(payments.map(p => p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}` : 'Système')));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paiements</h1>
          <p className="text-muted-foreground">
            {readOnly ? 'Consultez l’historique des paiements et leurs reçus.' : 'Gérez les encaissements et paiements des élèves.'}
          </p>
        </div>
        {!readOnly && (
          <Link href="/accountant/payments/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Enregistrer un paiement
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Historique des paiements</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Rechercher un élève..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Input
                type="date"
                className="w-full sm:w-40"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              <select
                className="w-full sm:w-48 h-10 px-3 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={accountantFilter}
                onChange={(e) => setAccountantFilter(e.target.value)}
              >
                <option value="">Tous les comptables</option>
                {uniqueAccountants.map((acc, idx) => (
                  <option key={idx} value={acc}>{acc}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Chargement des paiements...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Aucun paiement trouvé.</div>
          ) : (
            <div className="divide-y border rounded-md">
              {filteredPayments.map((p) => (
                <Link key={p.id} href={`${basePath}/payments/${p.id}`} className="group flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer">
                  <div className="flex items-center gap-3">
                    {p.status === 'confirmed' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium uppercase">
                        {[p.students?.last_name, p.students?.post_name, p.students?.first_name].filter(Boolean).join(' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Matricule: {p.students?.matricule}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      {p.amounts ? (
                        p.amounts.map((a: any, idx: number) => (
                          <p key={idx} className="text-sm font-bold">
                            {Number(a.amount).toLocaleString()} {a.currency}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm font-bold">{Number(p.amount).toLocaleString()} {p.currency}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{new Date(p.payment_date).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={p.status === 'confirmed' ? 'default' : 'destructive'}>
                      {p.status === 'confirmed' ? 'Confirmé' : 'Annulé'}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Search, Edit, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sendMessageAction, sendBroadcastAction, markConversationAsReadAction } from "@/app/actions/messages";

export function MessagesClient({ 
  initialConversations, 
  tenantId,
  userId 
}: { 
  initialConversations: any[];
  tenantId: string;
  userId: string;
}) {
  const supabase = createClient();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [newMessageBody, setNewMessageBody] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [targetType, setTargetType] = useState<"all" | "financial" | "specific_parents">("all");
  const [newSubject, setNewSubject] = useState("");
  const [newBroadcastBody, setNewBroadcastBody] = useState("");
  const [category, setCategory] = useState("general");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (activeConversationId) {
      markConversationAsReadAction(activeConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `tenant_id=eq.${tenantId}` }, () => {
         window.location.reload(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, supabase]);

  const handleSendMessage = async () => {
    if (!newMessageBody.trim() || !activeConversationId) return;
    const body = newMessageBody;
    setNewMessageBody("");
    
    await sendMessageAction(activeConversationId, tenantId, body, '/school/messages');
    window.location.reload();
  };

  const handleSendBroadcast = async () => {
    setIsSending(true);
    try {
      // Basic mock criteria for now. In a full implementation, you'd pull schoolYearId and refine criteria.
      const criteria = {
        tenantId,
        schoolYearId: 'dummy-year-id', 
        target: targetType,
        financial: targetType === 'financial' ? { status: 'overdue' as const } : undefined
      };
      
      await sendBroadcastAction(tenantId, 'dummy-year-id', newSubject, newBroadcastBody, category, criteria);
      setIsDialogOpen(false);
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'envoi de la diffusion.");
    } finally {
      setIsSending(false);
    }
  };

  const activeConversation = conversations.find(c => c.conversations.id === activeConversationId)?.conversations;

  return (
    <div className="flex h-[calc(100vh-80px)] bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
      <div className="w-1/3 border-r flex flex-col bg-slate-50/50">
        <div className="p-4 border-b bg-white flex justify-between items-center">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            Messages
          </h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Edit className="w-4 h-4 mr-2" />
                Nouveau
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Nouvelle Diffusion</DialogTitle>
                <DialogDescription>
                  Sélectionnez votre audience pour envoyer un message groupé sécurisé.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium">Audience cible</label>
                  <select 
                    className="w-full mt-1 p-2 border rounded-md"
                    value={targetType}
                    onChange={(e: any) => setTargetType(e.target.value)}
                  >
                    <option value="all">Tous les parents</option>
                    <option value="financial">Parents avec obligations en retard</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Sujet</label>
                  <Input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Objet du message" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Message</label>
                  <textarea 
                    className="w-full mt-1 min-h-[100px] p-3 rounded-md border"
                    placeholder="Contenu..."
                    value={newBroadcastBody}
                    onChange={e => setNewBroadcastBody(e.target.value)}
                  />
                </div>
                <Button onClick={handleSendBroadcast} disabled={isSending || !newSubject || !newBroadcastBody} className="w-full bg-emerald-600">
                  {isSending ? 'Envoi...' : 'Envoyer la diffusion'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="p-3 border-b bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Rechercher..." className="pl-9 bg-slate-50 border-slate-200" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Aucune conversation pour le moment.
            </div>
          ) : (
            conversations.map((c) => (
              <div 
                key={c.conversations.id}
                onClick={() => setActiveConversationId(c.conversations.id)}
                className={`p-4 border-b cursor-pointer transition-colors ${activeConversationId === c.conversations.id ? 'bg-emerald-50 border-l-4 border-l-emerald-600' : 'hover:bg-slate-50 bg-white border-l-4 border-l-transparent'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-slate-900 truncate">
                    {c.conversations.subject || 'Sans sujet'}
                  </span>
                </div>
                <div className="text-sm text-slate-600 truncate">
                  {c.conversations.category === 'broadcast' ? '📢 Diffusion' : '💬 Conversation'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-slate-50/30">
        {activeConversation ? (
          <>
            <div className="p-4 border-b bg-white shadow-sm z-10 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-slate-900">{activeConversation.subject}</h3>
                <p className="text-sm text-slate-500">Catégorie: {activeConversation.category}</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeConversation.messages?.map((msg: any) => {
                const isMe = msg.sender_id === userId;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl p-4 ${isMe ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-white border shadow-sm text-slate-900 rounded-tl-sm'}`}>
                      <div className="whitespace-pre-wrap text-sm">{msg.body}</div>
                      <div className={`text-[11px] mt-2 text-right ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t">
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                <Input placeholder="Écrire un message..." value={newMessageBody} onChange={e => setNewMessageBody(e.target.value)} className="flex-1" />
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={!newMessageBody.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <MessageCircle className="w-16 h-16 text-slate-200 mb-4" />
            <p className="text-lg font-medium text-slate-600">Vos messages</p>
            <p className="text-sm">Sélectionnez une conversation pour commencer</p>
          </div>
        )}
      </div>
    </div>
  );
}

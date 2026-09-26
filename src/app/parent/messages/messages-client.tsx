"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Search, Send, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sendMessageAction, startParentToDirectorConversationAction, markConversationAsReadAction } from "@/app/actions/messages";

export function ParentMessagesClient({ 
  initialConversations, 
  tenantId,
  tenantName,
  userId 
}: { 
  initialConversations: any[];
  tenantId: string;
  tenantName: string;
  userId: string;
}) {
  const supabase = createClient();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [newMessageBody, setNewMessageBody] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversationId, conversations]);

  // Mark as read when opening a conversation
  useEffect(() => {
    if (activeConversationId) {
      markConversationAsReadAction(activeConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    const channel = supabase.channel('schema-db-changes-parent')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
         // Refresh list logic here in a real app (could use SWR/React Query or server actions refresh)
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
    
    // Optimistic UI could be added here
    await sendMessageAction(activeConversationId, tenantId, body, '/parent/messages');
    window.location.reload();
  };

  const handleStartConversation = async () => {
    if (!newSubject.trim() || !newMessageBody.trim()) return;
    const res = await startParentToDirectorConversationAction(tenantId, newSubject, newMessageBody);
    setIsCreatingNew(false);
    setActiveConversationId(res.conversationId);
    window.location.reload();
  };

  const activeConversation = conversations.find(c => c.conversations.id === activeConversationId)?.conversations;

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Sidebar - Conversations List */}
      <div className="w-full md:w-1/3 border-r flex flex-col bg-slate-50/50">
        <div className="p-4 border-b bg-white flex justify-between items-center">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            Messages
          </h2>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setIsCreatingNew(true); setActiveConversationId(null); }}>
            <Plus className="w-4 h-4 mr-2" />
            Contacter la direction
          </Button>
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
                onClick={() => { setActiveConversationId(c.conversations.id); setIsCreatingNew(false); }}
                className={`p-4 border-b cursor-pointer transition-colors ${activeConversationId === c.conversations.id ? 'bg-emerald-50 border-l-4 border-l-emerald-600' : 'hover:bg-slate-50 bg-white border-l-4 border-l-transparent'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-slate-900 truncate">
                    {c.conversations.subject || 'Sans sujet'}
                  </span>
                </div>
                <div className="text-sm text-slate-600 truncate">
                  Direction de {tenantName}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="hidden md:flex flex-1 flex-col bg-slate-50/30 relative">
        {isCreatingNew ? (
           <div className="flex-1 flex flex-col p-8 max-w-2xl mx-auto w-full">
              <h2 className="text-xl font-semibold mb-6 text-slate-900">Nouvelle conversation avec la Direction</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Établissement concerné</label>
                  <Input disabled value={tenantName} className="mt-1 bg-slate-100" />
                  <p className="text-xs text-slate-500 mt-1">Vous communiquez de manière sécurisée avec l'administration de votre établissement.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Sujet</label>
                  <Input placeholder="Ex: Absence de mon enfant" value={newSubject} onChange={e => setNewSubject(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Message</label>
                  <textarea 
                    className="w-full mt-1 min-h-[150px] p-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="Votre message..."
                    value={newMessageBody}
                    onChange={e => setNewMessageBody(e.target.value)}
                  />
                </div>
                <Button onClick={handleStartConversation} className="bg-emerald-600 hover:bg-emerald-700 w-full" disabled={!newSubject || !newMessageBody}>
                  Envoyer le message
                </Button>
              </div>
           </div>
        ) : activeConversation ? (
          <>
            <div className="p-4 border-b bg-white shadow-sm z-10">
              <h3 className="font-semibold text-slate-900">{activeConversation.subject}</h3>
              <p className="text-sm text-slate-500">Avec: Direction de {tenantName}</p>
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
                <Input 
                  placeholder="Écrire une réponse..." 
                  value={newMessageBody}
                  onChange={(e) => setNewMessageBody(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={!newMessageBody.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <MessageCircle className="w-16 h-16 text-slate-200 mb-4" />
            <p className="text-lg font-medium text-slate-600">Messagerie Paylix</p>
            <p className="text-sm">Sélectionnez une conversation ou contactez la direction</p>
          </div>
        )}
      </div>
    </div>
  );
}

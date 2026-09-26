"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Search, Edit } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    // Basic realtime subscription for new messages
    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `tenant_id=eq.${tenantId}`
        },
        (payload) => {
          // Trigger a refresh or optimistically add the message to the conversation
          // This is a simplified approach
          console.log('New message received!', payload);
          // TODO: Update state
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, supabase]);

  const activeConversation = conversations.find(c => c.conversations.id === activeConversationId)?.conversations;

  return (
    <div className="flex h-[calc(100vh-80px)] bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
      {/* Sidebar - Conversations List */}
      <div className="w-1/3 border-r flex flex-col bg-slate-50/50">
        <div className="p-4 border-b bg-white flex justify-between items-center">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            Messages
          </h2>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <Edit className="w-4 h-4 mr-2" />
            Nouveau
          </Button>
        </div>
        
        <div className="p-3 border-b bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Rechercher..." 
              className="pl-9 bg-slate-50 border-slate-200"
            />
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
                  <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                    {new Date(c.conversations.updated_at).toLocaleDateString()}
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

      {/* Main Chat Area */}
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
            </div>

            <div className="p-4 bg-white border-t">
              <div className="flex gap-2">
                <Input 
                  placeholder="Écrire un message..." 
                  className="flex-1"
                />
                <Button className="bg-emerald-600 hover:bg-emerald-700">Envoyer</Button>
              </div>
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

"use client";

import { useState } from "react";
import { MessageCircle, Search, Send, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PlatformMessagesClient({ 
  initialConversations, 
  userId 
}: { 
  initialConversations: any[];
  userId: string;
}) {
  const [conversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const activeConversation = conversations.find(c => c.conversations.id === activeConversationId)?.conversations;

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
      {/* Sidebar - Conversations List */}
      <div className="w-full md:w-1/3 border-r flex flex-col bg-slate-50/50">
        <div className="p-4 border-b bg-white flex justify-between items-center">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-indigo-600" />
            Support Paylix
          </h2>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Message
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
                onClick={() => setActiveConversationId(c.conversations.id)}
                className={`p-4 border-b cursor-pointer transition-colors ${activeConversationId === c.conversations.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50 bg-white border-l-4 border-l-transparent'}`}
              >
                <div className="font-medium text-slate-900 truncate">
                  {c.conversations.subject || 'Sans sujet'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="hidden md:flex flex-1 flex-col bg-slate-50/30">
        {activeConversation ? (
          <>
            <div className="p-4 border-b bg-white shadow-sm z-10">
              <h3 className="font-semibold text-slate-900">{activeConversation.subject}</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeConversation.messages?.map((msg: any) => {
                const isMe = msg.sender_id === userId;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl p-4 ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border shadow-sm text-slate-900 rounded-tl-sm'}`}>
                      <div className="whitespace-pre-wrap text-sm">{msg.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t">
               <div className="flex gap-2">
                <Input placeholder="Écrire une réponse..." className="flex-1" />
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <MessageCircle className="w-16 h-16 text-slate-200 mb-4" />
            <p className="text-lg font-medium text-slate-600">Support Admin</p>
          </div>
        )}
      </div>
    </div>
  );
}

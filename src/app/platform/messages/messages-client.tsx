"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Send, Clock, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sendMessageAction, markReadAction } from "@/app/actions/messages";
import type { ConversationItem } from "@/app/actions/messages";

interface Props {
  initialConversations: ConversationItem[];
  userId: string;
}

export function PlatformMessagesClient({ initialConversations, userId }: Props) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, conversations]);

  useEffect(() => {
    if (activeId) {
      markReadAction(activeId);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, is_unread: false } : c))
      );
    }
  }, [activeId]);

  const handleSend = () => {
    if (!body.trim() || !activeId || !activeConv) return;
    const msg = body.trim();
    setBody("");
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: [...c.messages, { id: crypto.randomUUID(), body: msg, created_at: new Date().toISOString(), sender_id: userId }] }
          : c
      )
    );
    startTransition(async () => {
      // Use an empty-string tenant_id for platform-level — action handles this
      await sendMessageAction(activeId, "", msg, "/platform/messages");
    });
  };

  const openConversation = (id: string) => {
    setActiveId(id);
    setShowChat(true);
  };

  const unreadCount = conversations.filter((c) => c.is_unread).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-slate-50 px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Messages Plateforme
              {unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-[10px] h-5 px-1.5">{unreadCount}</Badge>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Communication inter-établissements</p>
          </div>
        </div>
      </div>

      {/* Chat layout */}
      <Card className="overflow-hidden shadow-sm">
        <div className="flex h-[calc(100vh-280px)] min-h-[400px]">
          {/* Sidebar */}
          <div className={`${showChat ? "hidden md:flex" : "flex"} w-full md:w-72 lg:w-80 border-r flex-col shrink-0`}>
            <div className="px-4 py-3 border-b bg-slate-50/50">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Conversations ({conversations.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <MessageCircle className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Aucune conversation</p>
                  <p className="text-xs text-slate-400 mt-1">Les messages des établissements apparaissent ici.</p>
                </div>
              ) : (
                conversations.map((c) => {
                  const lastMsg = c.messages[c.messages.length - 1];
                  const isActive = c.id === activeId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => openConversation(c.id)}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 ${isActive ? "bg-emerald-50 border-l-2 border-l-primary" : "hover:bg-slate-50 border-l-2 border-l-transparent"}`}
                      id={`conv-platform-${c.id}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        É
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm truncate ${c.is_unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
                            {c.subject ?? "Sans sujet"}
                          </span>
                          {c.is_unread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        {lastMsg && <p className="text-xs text-slate-500 truncate mt-0.5">{lastMsg.body}</p>}
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(c.updated_at).toLocaleDateString("fr-CD")}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className={`${!showChat ? "hidden md:flex" : "flex"} flex-1 flex-col`}>
            {activeConv ? (
              <>
                <div className="px-4 py-3 border-b bg-slate-50/50 flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setShowChat(false)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                    É
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{activeConv.subject ?? "Sans sujet"}</p>
                    <p className="text-xs text-slate-500">Établissement</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/20">
                  {activeConv.messages.map((msg) => {
                    const isMe = msg.sender_id === userId;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm"}`}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                          <p className={`text-[10px] mt-1 text-right ${isMe ? "text-primary-foreground/70" : "text-slate-400"}`}>
                            {new Date(msg.created_at).toLocaleTimeString("fr-CD", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="px-4 py-3 border-t bg-white">
                  <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                    <Input placeholder="Votre réponse..." value={body} onChange={(e) => setBody(e.target.value)} className="flex-1" id="platform-message-input" />
                    <Button type="submit" disabled={!body.trim() || isPending} className="shrink-0" id="platform-send-btn">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="text-base font-semibold text-slate-700">Support Paylix</p>
                <p className="text-sm text-slate-400 mt-1 max-w-xs">
                  Sélectionnez une conversation pour répondre.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

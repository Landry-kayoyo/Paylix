"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Send, Plus, Clock, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  sendMessageAction,
  startConversationWithDirectorAction,
  markReadAction,
  getConversationsAction,
} from "@/app/actions/messages";
import type { ConversationItem } from "@/app/actions/messages";

interface Props {
  initialConversations: ConversationItem[];
  tenantId: string;
  tenantName: string;
  userId: string;
}

export function ParentMessagesClient({ initialConversations, tenantId, tenantName, userId }: Props) {
  const supabase = createClient();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New conversation dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [sending, setSending] = useState(false);

  // Mobile: show list or chat
  const [showChat, setShowChat] = useState(false);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, conversations]);

  // Mark as read when opening
  useEffect(() => {
    if (activeId) {
      markReadAction(activeId);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, is_unread: false } : c))
      );
    }
  }, [activeId]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`parent-messages-${tenantId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `tenant_id=eq.${tenantId}` }, async () => {
        const updated = await getConversationsAction(tenantId);
        setConversations(updated);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, supabase]);

  const handleSend = () => {
    if (!body.trim() || !activeId) return;
    const msg = body.trim();
    setBody("");
    // Optimistic update
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: [...c.messages, { id: crypto.randomUUID(), body: msg, created_at: new Date().toISOString(), sender_id: userId }] }
          : c
      )
    );
    startTransition(async () => {
      await sendMessageAction(activeId, tenantId, msg, "/parent/messages");
      const updated = await getConversationsAction(tenantId);
      setConversations(updated);
    });
  };

  const handleStartConversation = async () => {
    if (!newSubject.trim() || !newBody.trim()) return;
    setSending(true);
    try {
      const { conversationId } = await startConversationWithDirectorAction(tenantId, newSubject.trim(), newBody.trim());
      const updated = await getConversationsAction(tenantId);
      setConversations(updated);
      setDialogOpen(false);
      setNewSubject("");
      setNewBody("");
      setActiveId(conversationId);
      setShowChat(true);
    } finally {
      setSending(false);
    }
  };

  const openConversation = (id: string) => {
    setActiveId(id);
    setShowChat(true);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-slate-50 px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Messagerie
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Communication avec {tenantName}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary hover:bg-primary/90" id="new-message-btn">
                <Plus className="h-4 w-4" />
                Contacter la direction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nouveau message</DialogTitle>
                <DialogDescription>Envoyer un message à la direction de {tenantName}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Sujet</label>
                  <Input className="mt-1" placeholder="Objet de votre message" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Message</label>
                  <textarea
                    className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    placeholder="Votre message..."
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={handleStartConversation}
                  disabled={sending || !newSubject.trim() || !newBody.trim()}
                  id="send-new-message-btn"
                >
                  {sending ? "Envoi en cours..." : "Envoyer le message"}
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Chat layout */}
      <Card className="overflow-hidden shadow-sm">
        <div className="flex h-[calc(100vh-280px)] min-h-[400px]">
          {/* Sidebar — Conversation list */}
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
                  <p className="text-xs text-slate-400 mt-1">Contactez la direction pour commencer.</p>
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
                      id={`conv-${c.id}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        D
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm truncate ${c.is_unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
                            {c.subject ?? "Sans sujet"}
                          </span>
                          {c.is_unread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        {lastMsg && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{lastMsg.body}</p>
                        )}
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
                {/* Chat header */}
                <div className="px-4 py-3 border-b bg-slate-50/50 flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setShowChat(false)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    D
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{activeConv.subject ?? "Sans sujet"}</p>
                    <p className="text-xs text-slate-500">Direction de {tenantName}</p>
                  </div>
                  {activeConv.category === "broadcast" && (
                    <Badge className="ml-auto bg-amber-100 text-amber-800 border-amber-200">📢 Diffusion</Badge>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/20">
                  {activeConv.messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      Commencez la conversation...
                    </div>
                  ) : (
                    activeConv.messages.map((msg) => {
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
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                {activeConv.category !== "broadcast" && (
                  <div className="px-4 py-3 border-t bg-white">
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                      <Input
                        placeholder="Votre réponse..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="flex-1"
                        id="message-input"
                      />
                      <Button type="submit" disabled={!body.trim() || isPending} className="shrink-0 gap-1.5" id="send-btn">
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                )}
                {activeConv.category === "broadcast" && (
                  <div className="px-4 py-2 border-t bg-amber-50/50 text-center">
                    <p className="text-xs text-amber-700">Message de diffusion — lecture seule</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="text-base font-semibold text-slate-700">Vos messages</p>
                <p className="text-sm text-slate-400 mt-1 max-w-xs">
                  Sélectionnez une conversation ou contactez la direction.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

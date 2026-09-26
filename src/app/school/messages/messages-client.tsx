"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Send, Plus, Users, Clock, ArrowLeft, Radio } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  sendBroadcastAction,
  markReadAction,
  getConversationsAction,
} from "@/app/actions/messages";
import type { ConversationItem } from "@/app/actions/messages";

interface Props {
  initialConversations: ConversationItem[];
  tenantId: string;
  userId: string;
  schoolYearId: string | null;
}

export function DirectorMessagesClient({ initialConversations, tenantId, userId, schoolYearId }: Props) {
  const supabase = createClient();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Broadcast dialog
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState<"all">("all");
  const [isSending, setIsSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

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

  // Realtime
  useEffect(() => {
    const channel = supabase.channel(`director-messages-${tenantId}`)
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
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: [...c.messages, { id: crypto.randomUUID(), body: msg, created_at: new Date().toISOString(), sender_id: userId }] }
          : c
      )
    );
    startTransition(async () => {
      await sendMessageAction(activeId, tenantId, msg, "/school/messages");
      const updated = await getConversationsAction(tenantId);
      setConversations(updated);
    });
  };

  const handleBroadcast = async () => {
    if (!broadcastSubject.trim() || !broadcastBody.trim()) return;
    setIsSending(true);
    setBroadcastResult(null);
    try {
      const result = await sendBroadcastAction(tenantId, broadcastSubject.trim(), broadcastBody.trim(), true);
      setBroadcastResult(`✅ Diffusion envoyée à ${result.count} parent(s).`);
      setBroadcastSubject("");
      setBroadcastBody("");
      const updated = await getConversationsAction(tenantId);
      setConversations(updated);
    } catch (e: any) {
      setBroadcastResult(`❌ Erreur: ${e.message}`);
    } finally {
      setIsSending(false);
    }
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
              Messages
              {unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-[10px] h-5 px-1.5">{unreadCount}</Badge>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Communication avec les parents</p>
          </div>
          <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary hover:bg-primary/90" id="broadcast-btn">
                <Radio className="h-4 w-4" />
                Nouvelle diffusion
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  Diffusion aux parents
                </DialogTitle>
                <DialogDescription>
                  Le message sera envoyé individuellement à chaque parent inscrit.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Audience</label>
                  <div className="mt-1 flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600">Tous les parents actifs</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">Auto</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Sujet</label>
                  <Input className="mt-1" placeholder="Objet de la diffusion" value={broadcastSubject} onChange={(e) => setBroadcastSubject(e.target.value)} id="broadcast-subject" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Message</label>
                  <textarea
                    className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    placeholder="Contenu de la diffusion..."
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    id="broadcast-body"
                  />
                </div>
                {broadcastResult && (
                  <p className="text-sm rounded-md border px-3 py-2 bg-muted/40">{broadcastResult}</p>
                )}
                <Button
                  className="w-full gap-2"
                  onClick={handleBroadcast}
                  disabled={isSending || !broadcastSubject.trim() || !broadcastBody.trim()}
                  id="send-broadcast-btn"
                >
                  {isSending ? "Envoi en cours..." : "Envoyer la diffusion"}
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
                  <p className="text-xs text-slate-400 mt-1">Envoyez une diffusion pour commencer.</p>
                </div>
              ) : (
                conversations.map((c) => {
                  const lastMsg = c.messages[c.messages.length - 1];
                  const isActive = c.id === activeId;
                  const isBroadcast = c.category === "broadcast";
                  return (
                    <button
                      key={c.id}
                      onClick={() => openConversation(c.id)}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 ${isActive ? "bg-emerald-50 border-l-2 border-l-primary" : "hover:bg-slate-50 border-l-2 border-l-transparent"}`}
                      id={`conv-dir-${c.id}`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${isBroadcast ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                        {isBroadcast ? <Radio className="h-3.5 w-3.5" /> : "P"}
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
                <div className="px-4 py-3 border-b bg-slate-50/50 flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setShowChat(false)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${activeConv.category === "broadcast" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                    {activeConv.category === "broadcast" ? <Radio className="h-3.5 w-3.5" /> : "P"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{activeConv.subject ?? "Sans sujet"}</p>
                    <p className="text-xs text-slate-500">{activeConv.category === "broadcast" ? "Diffusion" : "Conversation individuelle"}</p>
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
                    <Input
                      placeholder="Votre réponse..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="flex-1"
                      id="director-message-input"
                    />
                    <Button type="submit" disabled={!body.trim() || isPending} className="shrink-0" id="director-send-btn">
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
                <p className="text-base font-semibold text-slate-700">Messagerie Paylix</p>
                <p className="text-sm text-slate-400 mt-1 max-w-xs">
                  Sélectionnez une conversation ou envoyez une diffusion à tous les parents.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

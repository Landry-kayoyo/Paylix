"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Send, Clock, ArrowLeft, AlertCircle, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sendMessageAction, markReadAction, startPlatformConversationWithDirectorAction } from "@/app/actions/messages";
import type { ConversationItem } from "@/app/actions/messages";
import { getDefaultActiveConversationId } from "@/lib/messages-utils";
import type { PlatformRecipientOption } from "./page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConversationItemWithTenant extends ConversationItem {
  tenant_id?: string;
}

interface Props {
  initialConversations: ConversationItemWithTenant[];
  userId: string;
  recipients: PlatformRecipientOption[];
}

export function PlatformMessagesClient({ initialConversations, userId, recipients }: Props) {
  const supabase = createClient();
  const [conversations, setConversations] = useState<ConversationItemWithTenant[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showChat, setShowChat] = useState(false);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [recipientKey, setRecipientKey] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newMessageError, setNewMessageError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      const nextActiveId = getDefaultActiveConversationId(conversations);
      if (nextActiveId) {
        setActiveId(nextActiveId);
        setShowChat(true);
      }
    }
  }, [activeId, conversations]);

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

  // Realtime: listen across all tenants (no filter) — just refresh local state
  useEffect(() => {
    const channel = supabase.channel("platform-messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async () => {
        // Re-fetch conversations the user is participant in
        const { data } = await supabase
          .from("conversation_participants")
          .select(`last_read_at, archived_at, conversations!inner(id, subject, category, updated_at, tenant_id, messages(id, body, created_at, sender_id))`)
          .eq("user_id", userId)
          .is("archived_at", null);
        if (data) {
          const updated = data.map((row: any) => {
            const conv = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations;
            if (!conv) return null;
            const msgs = (Array.isArray(conv.messages) ? conv.messages : []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const is_unread = !row.last_read_at || new Date(conv.updated_at) > new Date(row.last_read_at);
            return { id: conv.id, subject: conv.subject, category: conv.category, updated_at: conv.updated_at, tenant_id: conv.tenant_id, last_read_at: row.last_read_at, is_unread, messages: msgs };
          }).filter(Boolean) as ConversationItemWithTenant[];
          setConversations(updated);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, userId]);

  const handleSend = () => {
    if (!body.trim() || !activeId || !activeConv) return;
    setSendError(null);
    const msg = body.trim();
    // Pass "" — sendMessageAction will resolve tenant_id from the conversation
    const tenantId = (activeConv as ConversationItemWithTenant).tenant_id ?? "";
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
      try {
        await sendMessageAction(activeId, tenantId, msg, "/platform/messages");
      } catch (e: any) {
        setSendError(e.message ?? "Erreur lors de l'envoi");
      }
    });
  };

  const openConversation = (id: string) => {
    setActiveId(id);
    setShowChat(true);
  };

  const handleCreateConversation = async () => {
    const recipient = recipients.find((item) => `${item.tenantId}:${item.directorId}` === recipientKey);
    if (!recipient || !newSubject.trim() || !newBody.trim()) return;

    setIsCreating(true);
    setNewMessageError(null);
    try {
      const { conversationId } = await startPlatformConversationWithDirectorAction(
        recipient.tenantId,
        recipient.directorId,
        newSubject,
        newBody
      );
      const createdAt = new Date().toISOString();
      const newConversation: ConversationItemWithTenant = {
        id: conversationId,
        subject: newSubject.trim(),
        category: "general",
        updated_at: createdAt,
        tenant_id: recipient.tenantId,
        last_read_at: createdAt,
        is_unread: false,
        messages: [{
          id: crypto.randomUUID(),
          body: newBody.trim(),
          created_at: createdAt,
          sender_id: userId,
        }],
      };
      setConversations((previous) => [newConversation, ...previous]);
      setActiveId(conversationId);
      setShowChat(true);
      setNewMessageOpen(false);
      setRecipientKey("");
      setNewSubject("");
      setNewBody("");
    } catch (error: unknown) {
      setNewMessageError(error instanceof Error ? error.message : "Impossible de créer le message.");
    } finally {
      setIsCreating(false);
    }
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
          <Dialog open={newMessageOpen} onOpenChange={(open) => {
            setNewMessageOpen(open);
            if (!open) setNewMessageError(null);
          }}>
            <DialogTrigger render={
              <Button className="gap-2 bg-primary hover:bg-primary/90" id="new-msg-platform-btn" disabled={recipients.length === 0}>
                <Plus className="h-4 w-4" />
                Nouveau message
              </Button>
            } />
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nouveau message</DialogTitle>
                <DialogDescription>Envoyez un message privé au directeur d’un établissement actif.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label htmlFor="platform-message-recipient" className="text-sm font-medium text-slate-700">Établissement / directeur</label>
                  <select
                    id="platform-message-recipient"
                    value={recipientKey}
                    onChange={(event) => setRecipientKey(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Choisir un destinataire</option>
                    {recipients.map((recipient) => (
                      <option key={`${recipient.tenantId}:${recipient.directorId}`} value={`${recipient.tenantId}:${recipient.directorId}`}>
                        {recipient.tenantName} — {recipient.directorName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="platform-message-subject" className="text-sm font-medium text-slate-700">Sujet</label>
                  <Input id="platform-message-subject" className="mt-1" placeholder="Objet du message" value={newSubject} onChange={(event) => setNewSubject(event.target.value)} />
                </div>
                <div>
                  <label htmlFor="platform-message-body" className="text-sm font-medium text-slate-700">Message</label>
                  <textarea
                    id="platform-message-body"
                    className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    placeholder="Contenu de votre message..."
                    value={newBody}
                    onChange={(event) => setNewBody(event.target.value)}
                  />
                </div>
                {newMessageError && <p role="alert" className="text-sm text-destructive">{newMessageError}</p>}
                <Button
                  className="w-full gap-2"
                  onClick={handleCreateConversation}
                  disabled={isCreating || !recipientKey || !newSubject.trim() || !newBody.trim()}
                  id="send-platform-new-msg-btn"
                >
                  {isCreating ? "Envoi en cours..." : <><Send className="h-4 w-4" /> Envoyer</>}
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
                  <p className="text-xs text-slate-400 mt-1">Les messages des établissements apparaissent ici.</p>
                  <Button
                    variant="outline"
                    className="mt-4 gap-2"
                    onClick={() => setNewMessageOpen(true)}
                    disabled={recipients.length === 0}
                    id="platform-empty-new-msg-btn"
                  >
                    <Plus className="h-4 w-4" />
                    Nouveau message
                  </Button>
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

                <div className="px-4 py-3 border-t bg-white space-y-2">
                  {sendError && (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs text-destructive">{sendError}</p>
                    </div>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                    <Input
                      placeholder="Votre réponse..."
                      value={body}
                      onChange={(e) => { setBody(e.target.value); setSendError(null); }}
                      className="flex-1"
                      id="platform-message-input"
                    />
                    <Button type="submit" disabled={!body.trim() || isPending} className="shrink-0 gap-1.5" id="platform-send-btn">
                      {isPending ? (
                        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
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
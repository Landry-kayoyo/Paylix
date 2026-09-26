"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MessageCircle, Send, Plus, Users, Clock, ArrowLeft,
  Radio, ChevronDown, Check, Search, UserCheck
} from "lucide-react";
import { Card } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  sendMessageAction,
  sendBroadcastAction,
  markReadAction,
  getConversationsAction,
  startConversationWithDirectorAction,
  startConversationWithParentAction,
} from "@/app/actions/messages";
import type { ConversationItem } from "@/app/actions/messages";
import type { ParentOption, ClassOption } from "./page";
import { getDefaultActiveConversationId } from "@/lib/messages-utils";

type TargetMode = "all" | "individual" | "financial";

interface Props {
  initialConversations: ConversationItem[];
  tenantId: string;
  userId: string;
  schoolYearId: string | null;
  parentOptions: ParentOption[];
  classOptions: ClassOption[];
}

export function DirectorMessagesClient({
  initialConversations,
  tenantId,
  userId,
  schoolYearId,
  parentOptions,
  classOptions,
}: Props) {
  const supabase = createClient();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showChat, setShowChat] = useState(false);
  const [searchConv, setSearchConv] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Broadcast / New message dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<TargetMode>("all");
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
  const [parentSearch, setParentSearch] = useState("");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const unreadCount = conversations.filter((c) => c.is_unread).length;

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      const nextActiveId = getDefaultActiveConversationId(conversations);
      if (nextActiveId) {
        setActiveId(nextActiveId);
        setShowChat(true);
      }
    }
  }, [activeId, conversations]);

  const filteredConversations = conversations.filter((c) =>
    !searchConv ||
    (c.subject ?? "").toLowerCase().includes(searchConv.toLowerCase()) ||
    (c.tenant_name ?? "").toLowerCase().includes(searchConv.toLowerCase()) ||
    (c.participant_names ?? []).some((name) => name.toLowerCase().includes(searchConv.toLowerCase()))
  );

  const getConversationTitle = (conversation: ConversationItem) => {
    if (conversation.category === "platform_support") return "Support Paylix";
    if (conversation.category !== "broadcast" && conversation.participant_names?.length) {
      return conversation.participant_names.join(", ");
    }
    return conversation.subject ?? "Sans sujet";
  };

  const filteredParents = parentOptions.filter((p) =>
    !parentSearch || (p.fullName ?? "").toLowerCase().includes(parentSearch.toLowerCase()) ||
    (p.email ?? "").toLowerCase().includes(parentSearch.toLowerCase())
  );

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
    const channel = supabase
      .channel(`director-messages-${tenantId}`)
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

  const handleSend2 = async () => {
    if (!broadcastSubject.trim() || !broadcastBody.trim()) return;
    if (targetMode === "individual" && selectedParentIds.length === 0) return;

    setIsSending(true);
    setSendError(null);

    try {
      let successMessage: string;
      if (targetMode === "individual") {
        const selectedParents = parentOptions.filter((parent) => selectedParentIds.includes(parent.userId));
        await startConversationWithParentAction(tenantId, selectedParentIds, broadcastSubject.trim(), broadcastBody.trim());
        const recipientNames = selectedParents.map((parent) => parent.fullName || "Parent").join(", ");
        successMessage = `Votre message a bien été envoyé à ${recipientNames}.`;
      } else {
        // Broadcast (all or financial)
        const result = await sendBroadcastAction(tenantId, broadcastSubject.trim(), broadcastBody.trim(), true);
        successMessage = `Votre message a bien été envoyé à ${result.count} parent(s).`;
      }

      setBroadcastSubject("");
      setBroadcastBody("");
      setSelectedParentIds([]);
      const updated = await getConversationsAction(tenantId);
      setConversations(updated);
      setDialogOpen(false);
      setConfirmationMessage(successMessage);
      setConfirmationOpen(true);
    } catch (e: any) {
      setSendError(e.message ?? "Erreur lors de l'envoi.");
    } finally {
      setIsSending(false);
    }
  };

  const openConversation = (id: string) => {
    setActiveId(id);
    setShowChat(true);
  };

  const getModeLabel = () => {
    if (targetMode === "all") return "Tous les parents";
    if (targetMode === "individual") return "Un parent spécifique";
    if (targetMode === "financial") return "Parents avec retard de paiement";
    return "";
  };

  const canSend = broadcastSubject.trim() && broadcastBody.trim() &&
    (targetMode !== "individual" || selectedParentIds.length > 0);

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
            <p className="text-sm text-slate-500 mt-0.5">Communication avec les parents et l'équipe</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setSendError(null); }}>
            <DialogTrigger
              render={
                <Button className="gap-2 bg-primary hover:bg-primary/90" id="new-msg-director-btn">
                  <Plus className="h-4 w-4" />
                  Nouveau message
                </Button>
              }
            />
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  Envoyer un message
                </DialogTitle>
                <DialogDescription>
                  Choisissez vos destinataires, rédigez votre message et envoyez.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* Target mode selector */}
                <div>
                  <label className="text-sm font-medium text-slate-700">Destinataires</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          className="w-full mt-1 justify-between font-normal"
                          id="target-mode-selector"
                        >
                          <span className="flex items-center gap-2">
                            {targetMode === "individual" ? <UserCheck className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-slate-400" />}
                            {getModeLabel()}
                          </span>
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent className="w-72">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-xs text-slate-500 font-normal">Mode d'envoi</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setTargetMode("all")} className="gap-2 cursor-pointer" id="target-all">
                          <Users className="h-4 w-4 text-emerald-600" />
                          <div>
                            <p className="text-sm font-medium">Tous les parents</p>
                            <p className="text-xs text-slate-400">Diffusion à {parentOptions.length} parent(s)</p>
                          </div>
                          {targetMode === "all" && <Check className="h-4 w-4 text-primary ml-auto" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTargetMode("individual")} className="gap-2 cursor-pointer" id="target-individual">
                          <UserCheck className="h-4 w-4 text-sky-600" />
                          <div>
                            <p className="text-sm font-medium">Un parent spécifique</p>
                            <p className="text-xs text-slate-400">Conversation privée</p>
                          </div>
                          {targetMode === "individual" && <Check className="h-4 w-4 text-primary ml-auto" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTargetMode("financial")} className="gap-2 cursor-pointer" id="target-financial">
                          <Users className="h-4 w-4 text-amber-600" />
                          <div>
                            <p className="text-sm font-medium">Parents avec retard</p>
                            <p className="text-xs text-slate-400">Obligations en retard de paiement</p>
                          </div>
                          {targetMode === "financial" && <Check className="h-4 w-4 text-primary ml-auto" />}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Individual parent selector */}
                {targetMode === "individual" && (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Choisir un ou plusieurs parents</label>
                    <div className="mt-1 relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Rechercher un parent..."
                        className="pl-9"
                        value={parentSearch}
                        onChange={(e) => setParentSearch(e.target.value)}
                        id="parent-search-input"
                      />
                    </div>
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-md border divide-y">
                      {filteredParents.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-slate-400 text-center">Aucun parent trouvé</p>
                      ) : (
                        filteredParents.map((p) => {
                          const isSelected = selectedParentIds.includes(p.userId);
                          return (
                            <button
                              key={p.userId}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => setSelectedParentIds((previous) =>
                                isSelected
                                  ? previous.filter((userId) => userId !== p.userId)
                                  : [...previous, p.userId]
                              )}
                              className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${isSelected ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                              id={`select-parent-${p.userId}`}
                            >
                              <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {(p.fullName || "?").charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{p.fullName || "Parent inconnu"}</p>
                                {p.email && <p className="text-xs text-slate-400 truncate">{p.email}</p>}
                              </div>
                              {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                    {selectedParentIds.length > 0 && (
                      <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {selectedParentIds.length} parent(s) sélectionné(s) : {parentOptions
                          .filter((parent) => selectedParentIds.includes(parent.userId))
                          .map((parent) => parent.fullName || "Parent")
                          .join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {targetMode === "financial" && (
                  <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2 flex items-start gap-2">
                    <Users className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">Ce message sera envoyé à tous les parents dont les élèves ont des obligations financières en retard dans votre établissement.</p>
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label className="text-sm font-medium text-slate-700">Sujet</label>
                  <Input
                    className="mt-1"
                    placeholder="Objet du message"
                    value={broadcastSubject}
                    onChange={(e) => setBroadcastSubject(e.target.value)}
                    id="broadcast-subject-input"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="text-sm font-medium text-slate-700">Message</label>
                  <textarea
                    className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    placeholder="Contenu de votre message..."
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    id="broadcast-body-input"
                  />
                </div>

                {/* Result feedback */}
                {sendError && (
                  <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {sendError}
                  </div>
                )}

                <Button
                  className="w-full gap-2"
                  onClick={handleSend2}
                  disabled={isSending || !canSend}
                  id="send-director-msg-btn"
                >
                  {isSending ? (
                    <><span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> Envoi en cours...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Envoyer</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
            <DialogContent className="max-w-md rounded-2xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="h-7 w-7" aria-hidden="true" />
              </div>
              <DialogHeader className="text-center">
                <DialogTitle>Message envoyé</DialogTitle>
                <DialogDescription>{confirmationMessage}</DialogDescription>
              </DialogHeader>
              <Button className="w-full" onClick={() => setConfirmationOpen(false)}>
                Fermer
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Chat layout */}
      <Card className="overflow-hidden shadow-sm">
        <div className="flex h-[calc(100vh-280px)] min-h-[400px]">
          {/* Sidebar */}
          <div className={`${showChat ? "hidden md:flex" : "flex"} w-full md:w-72 lg:w-80 border-r flex-col shrink-0`}>
            <div className="px-3 py-2 border-b bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Rechercher..."
                  className="pl-8 h-8 text-xs bg-white"
                  value={searchConv}
                  onChange={(e) => setSearchConv(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <MessageCircle className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Aucune conversation</p>
                  <p className="text-xs text-slate-400 mt-1">Créez un nouveau message pour commencer.</p>
                </div>
              ) : (
                filteredConversations.map((c) => {
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
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${isBroadcast ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {isBroadcast ? <Radio className="h-3.5 w-3.5" /> : "P"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm truncate ${c.is_unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
                            {getConversationTitle(c)}
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
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${activeConv.category === "broadcast" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {activeConv.category === "broadcast" ? <Radio className="h-3.5 w-3.5" /> : "P"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{getConversationTitle(activeConv)}</p>
                    <p className="text-xs text-slate-500">
                      {activeConv.category === "broadcast"
                        ? "📢 Message diffusé"
                        : activeConv.category === "platform_support"
                          ? "💬 Administration de la plateforme Paylix"
                          : "💬 Conversation individuelle"}
                    </p>
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
                    <Button type="submit" disabled={!body.trim() || isPending} className="shrink-0 gap-1.5" id="director-send-btn">
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
                <p className="text-base font-semibold text-slate-700">Messagerie de l'établissement</p>
                <p className="text-sm text-slate-400 mt-1 max-w-xs">
                  Sélectionnez une conversation ou créez un nouveau message.
                </p>
                <Button
                  variant="outline"
                  className="mt-4 gap-2"
                  onClick={() => setDialogOpen(true)}
                  id="empty-state-new-msg"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau message
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

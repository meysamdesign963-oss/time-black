"use client";

/**
 * MessagesView — direct messaging inbox.
 *
 * Two modes:
 *  1. `mode="inbox"` (default) — full conversations list + active chat panel.
 *  2. `mode="with"` — same UI but auto-selects a conversation with the user
 *     identified by `initialPartnerUsername`. Used by the router view
 *     "messages-with" (e.g. when clicking "پیام" on someone's profile).
 *
 * Fetches conversations on mount, polls every 30s for new messages, sends
 * messages optimistically (with rollback on error), and auto-scrolls to the
 * bottom of the active conversation when new messages arrive.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Inbox,
  Loader2,
  MessageCircle,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useRouterStore } from "@/store/router";
import { useAuthStore } from "@/store/auth";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatPersianTime,
  formatRelativeTime,
  toPersianDigits,
} from "@/utils/persian-date";

type Conversation = {
  partnerId: string;
  partnerUsername: string;
  partnerDisplayName: string;
  partnerAvatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

type ConversationsResp = { conversations: Conversation[] };
type MessagesResp = {
  messages: Message[];
  total: number;
  page: number;
  limit: number;
};

const POLL_INTERVAL = 30_000;

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.3, ease: "easeOut" as const },
  }),
};

export function MessagesView({
  /** When set, the view resolves this username → partnerId and opens that chat. */
  initialPartnerUsername,
}: {
  initialPartnerUsername?: string;
}) {
  const navigate = useRouterStore((s) => s.navigate);
  const user = useAuthStore((s) => s.user);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);

  // Messages of the active conversation
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  // Track the most recent message createdAt so polling can skip refetching
  // when nothing has changed.
  const lastMsgAtRef = useRef<string | null>(null);
  // Track which partner was resolved for initialPartnerUsername so we don't
  // loop forever if the lookup fails.
  const resolvedPartnerRef = useRef<string | null>(null);

  // ------------------------------------------------------------------
  // Fetch conversations list
  // ------------------------------------------------------------------
  const fetchConversations = useCallback(async () => {
    const res = await apiFetch<ConversationsResp>(
      "/api/messages/conversations",
    );
    if (res.ok && res.data?.conversations) {
      setConversations(res.data.conversations);
    }
    setConvLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    let active = true;
    (async () => {
      await fetchConversations();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [fetchConversations]);

  // Poll for new conversations every 30s
  useEffect(() => {
    const t = setInterval(() => {
      fetchConversations();
    }, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchConversations]);

  // ------------------------------------------------------------------
  // Resolve initialPartnerUsername → partnerId (auto-open conversation)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!initialPartnerUsername) return;
    if (resolvedPartnerRef.current === initialPartnerUsername) return;

    let active = true;
    (async () => {
      // First, check if there's an existing conversation with this username.
      const res = await apiFetch<ConversationsResp>(
        "/api/messages/conversations",
      );
      if (!active) return;
      const conv = res.data?.conversations?.find(
        (c) =>
          c.partnerUsername.toLowerCase() ===
          initialPartnerUsername.toLowerCase(),
      );
      if (conv) {
        resolvedPartnerRef.current = initialPartnerUsername;
        setActivePartnerId(conv.partnerId);
        return;
      }
      // Otherwise, look up the user by username to get their id so we can
      // open a fresh conversation thread (POST /api/messages will create it
      // on first send).
      const profileRes = await apiFetch<{
        profile: { id: string; username: string; displayName: string };
      }>(`/api/profile/${encodeURIComponent(initialPartnerUsername)}`);
      if (!active) return;
      if (profileRes.ok && profileRes.data?.profile) {
        resolvedPartnerRef.current = initialPartnerUsername;
        const p = profileRes.data.profile;
        // Inject a placeholder conversation into the list so the chat panel
        // can render before the first message is sent.
        setActivePartnerId(p.id);
        setConversations((prev) => {
          if (prev.some((c) => c.partnerId === p.id)) return prev;
          return [
            {
              partnerId: p.id,
              partnerUsername: p.username,
              partnerDisplayName: p.displayName,
              partnerAvatarUrl: null,
              lastMessage: "",
              lastMessageAt: new Date().toISOString(),
              unreadCount: 0,
            },
            ...prev,
          ];
        });
      } else {
        resolvedPartnerRef.current = initialPartnerUsername;
        toast.error("کاربر یافت نشد");
      }
    })();
    return () => {
      active = false;
    };
  }, [initialPartnerUsername]);

  // The active conversation object (looked up from the list)
  const activeConversation = useMemo(
    () =>
      conversations.find((c) => c.partnerId === activePartnerId) ?? null,
    [conversations, activePartnerId],
  );

  // ------------------------------------------------------------------
  // Fetch messages for active conversation
  // ------------------------------------------------------------------
  const fetchMessages = useCallback(
    async (partnerId: string, silent = false) => {
      if (!silent) setMsgLoading(true);
      const res = await apiFetch<MessagesResp>(
        `/api/messages?partnerId=${encodeURIComponent(partnerId)}&page=1&limit=100`,
      );
      if (res.ok && res.data?.messages) {
        setMessages(res.data.messages);
        lastMsgAtRef.current =
          res.data.messages.length > 0
            ? res.data.messages[res.data.messages.length - 1].createdAt
            : null;
        // Mark as read locally (server already marks them read on GET).
        setConversations((prev) =>
          prev.map((c) =>
            c.partnerId === partnerId ? { ...c, unreadCount: 0 } : c,
          ),
        );
      }
      if (!silent) setMsgLoading(false);
    },
    [],
  );

  // Fetch on partner change
  useEffect(() => {
    if (!activePartnerId) {
      // Defer the state reset to escape the effect body
      setTimeout(() => {
        setMessages([]);
        lastMsgAtRef.current = null;
      }, 0);
      return;
    }
    let active = true;
    (async () => {
      await fetchMessages(activePartnerId);
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [activePartnerId, fetchMessages]);

  // Poll for new messages in the active conversation
  useEffect(() => {
    if (!activePartnerId) return;
    const t = setInterval(() => {
      fetchMessages(activePartnerId, true);
    }, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [activePartnerId, fetchMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // ------------------------------------------------------------------
  // Send message (optimistic with rollback)
  // ------------------------------------------------------------------
  const handleSend = async () => {
    const content = draft.trim();
    if (!content) return;
    if (!user) {
      navigate("login");
      return;
    }
    if (!activePartnerId) return;
    if (sending) return;

    const tempId = `tmp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      senderId: user.id,
      recipientId: activePartnerId,
      content,
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setDraft("");
    setSending(true);

    const res = await apiFetch<{ message: Message }>("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        recipientId: activePartnerId,
        content,
      }),
    });

    setSending(false);

    if (res.ok && res.data?.message) {
      // Replace optimistic message with the real one
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? res.data!.message : m)),
      );
      // Update conversation list preview + time
      setConversations((prev) => {
        const exists = prev.some((c) => c.partnerId === activePartnerId);
        if (!exists) return prev;
        return prev
          .map((c) =>
            c.partnerId === activePartnerId
              ? {
                  ...c,
                  lastMessage: content,
                  lastMessageAt: new Date().toISOString(),
                }
              : c,
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt).getTime() -
              new Date(a.lastMessageAt).getTime(),
          );
      });
    } else {
      // Rollback
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(content);
      toast.error(res.error || "ارسال پیام ناموفق بود");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-[1000px] space-y-4 px-4 py-6">
      <PageHeader
        title="پیام‌ها"
        description="مکالمات خصوصی با کاربران Time Black"
        action={
          initialPartnerUsername ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("messages")}
            >
              <ArrowRight className="h-4 w-4" />
              همه مکالمات
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* ----------------------- Conversation list ----------------------- */}
        <Card className="glass md:col-span-1 flex flex-col overflow-hidden p-0">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-medium">مکالمات</h2>
              </div>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {toPersianDigits(conversations.length)}
              </Badge>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {convLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary/50">
                    <Inbox className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    هنوز مکالمه‌ای ندارید
                  </p>
                  <p className="text-xs text-muted-foreground">
                    با کلیک روی دکمه «پیام» در پروفایل کاربران، مکالمه شروع کنید.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {conversations.map((c, i) => {
                    const active = c.partnerId === activePartnerId;
                    return (
                      <motion.li
                        key={c.partnerId}
                        custom={i}
                        variants={fadeUp}
                        initial="hidden"
                        animate="show"
                      >
                        <button
                          onClick={() => setActivePartnerId(c.partnerId)}
                          className={`flex w-full items-start gap-3 px-3 py-3 text-right transition-colors ${
                            active
                              ? "bg-primary/10"
                              : "hover:bg-secondary/40"
                          }`}
                        >
                          <Avatar className="h-10 w-10 shrink-0">
                            {c.partnerAvatarUrl && (
                              <AvatarImage
                                src={c.partnerAvatarUrl}
                                alt={c.partnerDisplayName}
                              />
                            )}
                            <AvatarFallback className="bg-secondary text-primary text-sm">
                              {c.partnerDisplayName?.charAt(0) || "؟"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium text-foreground">
                                {c.partnerDisplayName}
                              </p>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {c.lastMessageAt
                                  ? formatRelativeTime(
                                      new Date(c.lastMessageAt),
                                    )
                                  : ""}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              @{c.partnerUsername}
                            </p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <p
                                className="line-clamp-1 flex-1 text-xs text-foreground/70"
                                dir="auto"
                              >
                                {c.lastMessage || "—"}
                              </p>
                              {c.unreadCount > 0 && (
                                <Badge className="bg-primary text-primary-foreground px-1.5 py-0 text-[10px]">
                                  {toPersianDigits(c.unreadCount)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ----------------------- Active conversation ----------------------- */}
        <Card className="glass md:col-span-2 flex flex-col overflow-hidden p-0">
          {!activePartnerId || !activeConversation ? (
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary/40">
                <MessageCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-academic text-lg font-bold text-foreground">
                یک مکالمه را انتخاب کنید
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                برای مشاهده و ارسال پیام، یکی از مکالمات سمت راست را انتخاب
                کنید.
              </p>
            </CardContent>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                <Avatar className="h-10 w-10">
                  {activeConversation.partnerAvatarUrl && (
                    <AvatarImage
                      src={activeConversation.partnerAvatarUrl}
                      alt={activeConversation.partnerDisplayName}
                    />
                  )}
                  <AvatarFallback className="bg-secondary text-primary text-sm">
                    {activeConversation.partnerDisplayName?.charAt(0) || "؟"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() =>
                      navigate("profile", activeConversation.partnerUsername)
                    }
                    className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {activeConversation.partnerDisplayName}
                  </button>
                  <p className="truncate text-xs text-muted-foreground">
                    @{activeConversation.partnerUsername}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                className="flex max-h-[60vh] min-h-[280px] flex-1 flex-col gap-2 overflow-y-auto p-4"
              >
                {msgLoading ? (
                  <div className="m-auto space-y-2">
                    <Skeleton className="h-12 w-64 rounded-xl" />
                    <Skeleton className="ml-auto h-12 w-48 rounded-xl" />
                    <Skeleton className="h-12 w-72 rounded-xl" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="m-auto flex flex-col items-center gap-2 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary/40">
                      <MessageCircle className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      هنوز پیامی رد و بدل نشده — اولین پیام را ارسال کنید!
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = user && m.senderId === user.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isMine ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          dir="auto"
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            isMine
                              ? "bg-primary text-primary-foreground rounded-tl-sm"
                              : "bg-secondary text-foreground rounded-tr-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {m.content}
                          </p>
                          <p
                            className={`mt-1 text-[10px] ${
                              isMine
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatPersianTime(new Date(m.createdAt))}
                            {isMine && m.isRead && " · خوانده شد"}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-border/60 p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="پیام خود را بنویسید… (Enter برای ارسال)"
                    className="min-h-[44px] max-h-32 flex-1 resize-none"
                    rows={1}
                    disabled={sending}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label="ارسال"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                  Shift+Enter برای خط جدید
                </p>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default MessagesView;

"use client";

import * as React from "react";
import { ArrowUp, Check, Copy, ImagePlus, X } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { AICoachIllustration } from "@/components/illustrations";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Client-side only (data: URL) — the screenshot the user attached, if any. Never round-trips through the server (see route.ts: images are never persisted). */
  imageDataUrl?: string;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface PendingImage {
  dataUrl: string;
  mediaType: string;
  base64Data: string;
}

const SUGGESTED_PROMPT_KEYS = [
  "monthSummary",
  "topFocus",
  "overspending",
  "reachGoalFaster",
  "debtAdvice",
  "safeToSpendExplain",
  "wealthScoreExplain",
  "incomeSourceIdeas",
  "fastestSkill",
  "reachExtraIncome",
  "sideHustleForMyTime",
  "todayIncomeMission",
  "whatMissionToday",
  "upcomingBillsQuestion",
  "unusedSubscriptionQuestion",
  "financialProgressQuestion",
] as const;

const TEXTAREA_MAX_HEIGHT_PX = 160;

// The model naturally writes markdown (**bold**, numbered lists) — this
// used to render as literal, unrendered "**" characters in the chat bubble
// since messages were shown as plain text. Kept deliberately minimal: no
// headings/tables/images/raw HTML, just what a coaching reply actually
// uses, restyled to fit the compact bubble instead of the browser's
// default block spacing.
const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="m-0 empty:hidden">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }) => <ul className="m-0 list-disc space-y-0.5 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="m-0 list-decimal space-y-0.5 pl-4">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
};

function CopyMessageButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  const resetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (resetRef.current) clearTimeout(resetRef.current);
  }, []);

  return (
    <Button
      type="button"
      aria-label={label}
      variant="ghost"
      size="icon-xs"
      className="rounded-lg text-muted-foreground hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          if (resetRef.current) clearTimeout(resetRef.current);
          resetRef.current = setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard access can fail silently (permissions/insecure context) — no user-facing error needed for a copy affordance.
        }
      }}
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
    </Button>
  );
}

/**
 * Client-side chat surface. Talks only to `/api/ai/chat` (never a provider
 * directly) and parses the newline-delimited JSON event stream that route
 * emits. A non-streaming JSON error/notice response (validation failure,
 * AI not configured, or a distress short-circuit) is handled the same way
 * as a finished streamed reply — the UI doesn't need to know which path
 * produced a given message.
 */
export function AICoachChat({
  initialConversationId,
  initialMessages,
}: {
  initialConversationId?: string;
  initialMessages?: ChatMessage[];
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages ?? []);
  const [input, setInput] = React.useState("");
  const [conversationId, setConversationId] = React.useState<string | undefined>(initialConversationId);
  const [isSending, setIsSending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [pendingImage, setPendingImage] = React.useState<PendingImage | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // "Stick to bottom" while streaming, but stop following the moment the
  // user scrolls away — a reply can run to many paragraphs, and locking
  // the page to the newest token means the user can never read up while
  // it's still arriving. Re-armed whenever the user sends a new message
  // (see sendMessage below), matching the usual chat-app convention.
  const stickToBottomRef = React.useRef(true);
  const NEAR_BOTTOM_PX = 120;

  React.useEffect(() => {
    function handleScroll() {
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      stickToBottomRef.current = distanceFromBottom < NEAR_BOTTOM_PX;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setErrorMessage(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage(t("aiCoach.errorImageUnsupportedType"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMessage(t("aiCoach.errorImageTooLarge"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      // data:image/png;base64,iVBORw0... -> just the part after the comma.
      const base64Data = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (!base64Data) {
        setErrorMessage(t("aiCoach.errorGeneric"));
        return;
      }
      setPendingImage({ dataUrl, mediaType: file.type, base64Data });
    };
    reader.onerror = () => setErrorMessage(t("aiCoach.errorGeneric"));
    reader.readAsDataURL(file);
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    const image = pendingImage;
    if ((!trimmed && !image) || isSending) return;

    setErrorMessage(null);
    setInput("");
    setPendingImage(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    // The user just acted — resume following the conversation even if they'd
    // scrolled away reading an earlier reply.
    stickToBottomRef.current = true;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed, imageDataUrl: image?.dataUrl },
    ]);
    setIsSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationId,
          image: image ? { mediaType: image.mediaType, base64Data: image.base64Data } : undefined,
        }),
      });

      const contentType = res.headers.get("Content-Type") ?? "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(typeof data.error === "string" ? data.error : t("aiCoach.errorGeneric"));
          return;
        }
        if (typeof data.conversationId === "string") setConversationId(data.conversationId);
        if (typeof data.reply === "string") {
          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.reply }]);
        }
        return;
      }

      if (!res.body) {
        setErrorMessage(t("aiCoach.errorGeneric"));
        return;
      }

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: { type: string; text?: string; conversationId?: string; message?: string };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "conversation" && event.conversationId) {
            setConversationId(event.conversationId);
          } else if (event.type === "delta" && event.text) {
            const chunk = event.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
            );
          } else if (event.type === "error") {
            sawError = true;
            setErrorMessage(event.message ?? t("aiCoach.errorGeneric"));
          }
        }
      }

      if (sawError) {
        // Drop the empty/partial assistant bubble — the error banner covers it.
        setMessages((prev) => prev.filter((m) => !(m.id === assistantId && m.content === "")));
      }
    } catch {
      setErrorMessage(t("aiCoach.errorGeneric"));
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  function renderBubbleParagraphs(text: string, align: "start" | "end") {
    return text.split("\n\n").map((paragraph, idx) => (
      <Bubble align={align} key={idx} variant={align === "end" ? "muted" : "ghost"}>
        <BubbleContent className="text-[15px]/6">
          <ReactMarkdown remarkPlugins={[remarkBreaks]} components={MARKDOWN_COMPONENTS}>
            {paragraph}
          </ReactMarkdown>
        </BubbleContent>
      </Bubble>
    ));
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center gap-3 pt-8 pb-8 text-center">
            <AICoachIllustration size={120} />
            <p className="font-medium">{t("aiCoach.emptyTitle")}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t("aiCoach.emptyState")}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPT_KEYS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => void sendMessage(t(`aiCoach.suggestedPrompts.${key}`))}
                >
                  {t(`aiCoach.suggestedPrompts.${key}`)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4.5" role="log" aria-live="polite" aria-label={t("aiCoach.title")}>
          {messages.map((m, i) => {
            const align = m.role === "user" ? "end" : "start";
            const isLast = i === messages.length - 1;
            const isThinking = isSending && isLast && m.role === "assistant" && !m.content;

            return (
              <Message align={align} className="animate-in fade-in slide-in-from-bottom-1 duration-(--motion-normal)" key={m.id}>
                <MessageContent className="gap-1.5">
                  {m.imageDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a transient client-side data: URL (never uploaded/persisted), not an optimizable remote/static asset next/image expects.
                    <img
                      src={m.imageDataUrl}
                      alt={t("aiCoach.imageAttachedAlt")}
                      className="max-h-48 w-auto max-w-full rounded-xl object-contain"
                    />
                  ) : null}
                  {isThinking ? (
                    <Bubble align={align} variant="ghost">
                      <BubbleContent>
                        <span className="text-[15px]/6 text-muted-foreground animate-pulse">{t("aiCoach.thinking")}</span>
                      </BubbleContent>
                    </Bubble>
                  ) : (
                    m.content ? renderBubbleParagraphs(m.content, align) : null
                  )}
                  {m.content && !isThinking ? (
                    <MessageFooter className="-mx-1.5">
                      <CopyMessageButton text={m.content} label={t("aiCoach.copy")} />
                    </MessageFooter>
                  ) : null}
                </MessageContent>
              </Message>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {errorMessage ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {pendingImage ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- transient client-side data: URL preview of a not-yet-sent attachment, not an optimizable asset. */}
          <img src={pendingImage.dataUrl} alt={t("aiCoach.imageAttachedAlt")} className="h-16 w-16 rounded-lg object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            aria-label={t("aiCoach.removeImage")}
            className="absolute -right-1.5 -top-1.5 rounded-full shadow-card"
            onClick={() => setPendingImage(null)}
          >
            <X className="size-3" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={handleFileSelect}
          hidden
        />
        <InputGroup className="h-auto min-h-11 items-end rounded-[22px] px-0.5 py-0.5">
          <InputGroupAddon align="inline-start" className="pb-1.25 pl-1.5">
            <InputGroupButton
              type="button"
              aria-label={t("aiCoach.attachImage")}
              disabled={isSending}
              size="icon-sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="size-4" aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
          <InputGroupTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
            }}
            placeholder={t("aiCoach.inputPlaceholder")}
            aria-label={t("aiCoach.inputPlaceholder")}
            disabled={isSending}
            className="min-h-9 py-2 pl-1 text-[15px]/6"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
          />
          <InputGroupAddon align="inline-end" className="pr-1.5 pb-1.25">
            <InputGroupButton
              type="submit"
              aria-label={t("aiCoach.send")}
              disabled={isSending || (!input.trim() && !pendingImage)}
              size="icon-sm"
              variant="default"
              className={cn(
                "rounded-full transition-transform duration-(--motion-fast) ease-(--ease-standard)",
                input.trim() || pendingImage ? "scale-100 opacity-100" : "scale-90 opacity-60"
              )}
            >
              <ArrowUp className="size-4" aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}

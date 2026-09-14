"use client";

import * as React from "react";
import { Send } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AICoachIllustration } from "@/components/illustrations";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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

/**
 * Client-side chat surface. Talks only to `/api/ai/chat` (never a provider
 * directly) and parses the newline-delimited JSON event stream that route
 * emits. A non-streaming JSON error/notice response (validation failure,
 * AI not configured, or a distress short-circuit) is handled the same way
 * as a finished streamed reply — the UI doesn't need to know which path
 * produced a given message.
 */
export function AICoachChat({ initialConversationId }: { initialConversationId?: string }) {
  const { t } = useTranslation();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [conversationId, setConversationId] = React.useState<string | undefined>(initialConversationId);
  const [isSending, setIsSending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setErrorMessage(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setIsSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId }),
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
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        }
        return;
      }

      if (!res.body) {
        setErrorMessage(t("aiCoach.errorGeneric"));
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
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
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role !== "assistant") return prev;
              return [...prev.slice(0, -1), { role: "assistant", content: last.content + chunk }];
            });
          } else if (event.type === "error") {
            sawError = true;
            setErrorMessage(event.message ?? t("aiCoach.errorGeneric"));
          }
        }
      }

      if (sawError) {
        // Drop the empty/partial assistant bubble — the error banner covers it.
        setMessages((prev) => (prev[prev.length - 1]?.content === "" ? prev.slice(0, -1) : prev));
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

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <Card>
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
                  className="text-xs"
                  onClick={() => void sendMessage(t(`aiCoach.suggestedPrompts.${key}`))}
                >
                  {t(`aiCoach.suggestedPrompts.${key}`)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm break-words",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {m.content || (isSending && i === messages.length - 1 ? t("aiCoach.thinking") : "")}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {errorMessage ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("aiCoach.inputPlaceholder")}
          disabled={isSending}
          className="min-h-11 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(input);
            }
          }}
        />
        <Button type="submit" size="icon" disabled={isSending || !input.trim()} aria-label={t("aiCoach.send")}>
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}

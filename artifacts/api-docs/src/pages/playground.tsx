import { useState, useRef, useCallback } from "react";

const MODELS = [
  { id: "claude-opus-4-6", provider: "Anthropic", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", provider: "Anthropic", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", provider: "Anthropic", label: "Claude Haiku 4.5" },
  { id: "gpt-5.2", provider: "OpenAI", label: "GPT-5.2" },
  { id: "gpt-5", provider: "OpenAI", label: "GPT-5" },
  { id: "gpt-5-mini", provider: "OpenAI", label: "GPT-5 Mini" },
  { id: "o4-mini", provider: "OpenAI", label: "o4-mini" },
];

const EXAMPLE_TOOL = JSON.stringify(
  [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get current weather for a city",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string", description: "City name" },
          },
          required: ["city"],
        },
      },
    },
  ],
  null,
  2
);

type Message = {
  role: "user" | "assistant";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export default function Playground() {
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [stream, setStream] = useState(true);
  const [useTool, setUseTool] = useState(false);
  const [input, setInput] = useState("Say hello in one sentence.");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const baseUrl = window.location.origin + "/api";

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    setError(null);

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: input.trim() },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setStreamText("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const body: Record<string, unknown> = {
      model,
      messages: newMessages,
      stream,
      max_tokens: 1024,
    };

    if (useTool) {
      try {
        body["tools"] = JSON.parse(EXAMPLE_TOOL);
      } catch {
        body["tools"] = [];
      }
    }

    try {
      const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!resp.ok) {
        const text = await resp.text();
        setError(`HTTP ${resp.status}: ${text}`);
        setLoading(false);
        return;
      }

      if (stream) {
        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                accumulated += delta.content;
                setStreamText(accumulated);
              }
              if (delta?.tool_calls) {
                // Tool call partial — we could accumulate here
              }
            } catch {
              // skip malformed
            }
          }
        }

        if (accumulated) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: accumulated },
          ]);
        }
        setStreamText("");
      } else {
        const data = await resp.json();
        const choice = data.choices?.[0];
        if (choice) {
          const assistantMsg: Message = {
            role: "assistant",
            content: choice.message?.content ?? "",
          };
          if (choice.message?.tool_calls) {
            assistantMsg.tool_calls = choice.message.tool_calls;
          }
          setMessages((prev) => [...prev, assistantMsg]);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, messages, model, stream, useTool, loading, baseUrl]);

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
    if (streamText) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: streamText + " [stopped]" },
      ]);
      setStreamText("");
    }
  };

  const clear = () => {
    setMessages([]);
    setStreamText("");
    setError(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls bar */}
      <div className="flex flex-wrap gap-3 items-center px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Model</label>
          <select
            data-testid="select-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-sm bg-background border border-border rounded-md px-2 py-1 focus:ring-1 focus:ring-primary outline-none"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.provider})
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer text-sm text-muted-foreground">
          <input
            type="checkbox"
            data-testid="toggle-stream"
            checked={stream}
            onChange={(e) => setStream(e.target.checked)}
            className="accent-primary w-3.5 h-3.5"
          />
          Stream
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer text-sm text-muted-foreground">
          <input
            type="checkbox"
            data-testid="toggle-tools"
            checked={useTool}
            onChange={(e) => setUseTool(e.target.checked)}
            className="accent-primary w-3.5 h-3.5"
          />
          Tool Call
        </label>

        <button
          data-testid="button-clear"
          onClick={clear}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && !streamText && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Send a message to start chatting
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            data-testid={`message-${msg.role}-${i}`}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground"
              }`}
            >
              {msg.tool_calls && msg.tool_calls.length > 0 ? (
                <div className="space-y-2">
                  {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                  {msg.tool_calls.map((tc, j) => (
                    <div
                      key={j}
                      className="bg-background/60 rounded-lg p-2 border border-border"
                    >
                      <p className="text-xs text-primary font-mono font-semibold mb-1">
                        Tool: {tc.function.name}
                      </p>
                      <pre className="text-xs code-block text-muted-foreground overflow-x-auto">
                        {JSON.stringify(JSON.parse(tc.function.arguments), null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {streamText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] bg-card border border-border rounded-xl px-4 py-2.5 text-sm leading-relaxed">
              <p className="whitespace-pre-wrap">{streamText}</p>
              <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 cursor-blink align-text-bottom" />
            </div>
          </div>
        )}

        {loading && !streamText && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-border bg-card/30">
        <div className="flex gap-2">
          <input
            data-testid="input-message"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
          />
          {loading ? (
            <button
              data-testid="button-stop"
              onClick={stop}
              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Stop
            </button>
          ) : (
            <button
              data-testid="button-send"
              onClick={send}
              disabled={!input.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

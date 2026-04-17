type EndpointBadgeProps = {
  method: string;
  path: string;
};

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    DELETE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  return (
    <span
      className={`inline-block text-xs font-bold font-mono px-2 py-0.5 rounded ${colors[method] ?? "bg-gray-100 text-gray-700"}`}
    >
      {method}
    </span>
  );
}

function EndpointBlock({ method, path }: EndpointBadgeProps) {
  return (
    <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 font-mono text-sm">
      <MethodBadge method={method} />
      <span className="text-foreground">{path}</span>
    </div>
  );
}

function CodeBlock({ code, lang = "" }: { code: string; lang?: string }) {
  return (
    <pre className={`code-block bg-sidebar text-sidebar-foreground rounded-xl p-4 overflow-x-auto text-xs leading-relaxed border border-sidebar-border ${lang}`}>
      <code>{code.trim()}</code>
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function Docs() {
  const base = window.location.origin + "/api/v1";

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">API Reference</h1>
        <p className="mt-2 text-muted-foreground leading-relaxed">
          OpenAI-compatible reverse proxy. Point any OpenAI SDK or client at this endpoint — Claude and GPT models both work out of the box.
        </p>
        <div className="mt-4 flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Base URL</span>
          <span className="font-mono text-sm text-primary">{window.location.origin}/api/v1</span>
        </div>
      </div>

      <Section title="Authentication">
        <p className="text-sm text-muted-foreground leading-relaxed">
          This proxy is powered by Replit AI Integrations — no API key is required. You can pass any value as the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">Authorization</code> header and it will be accepted.
        </p>
        <CodeBlock code={`Authorization: Bearer any-value`} />
      </Section>

      <Section title="Supported Models">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm font-semibold">Anthropic</span>
            </div>
            {["claude-opus-4-6", "claude-opus-4-5", "claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"].map((m) => (
              <div key={m} className="font-mono text-xs text-muted-foreground pl-4">{m}</div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-semibold">OpenAI</span>
            </div>
            {["gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4o", "o4-mini", "o3"].map((m) => (
              <div key={m} className="font-mono text-xs text-muted-foreground pl-4">{m}</div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="List Models">
        <EndpointBlock method="GET" path="/v1/models" />
        <p className="text-sm text-muted-foreground">Returns all supported models in OpenAI format.</p>
        <CodeBlock code={`curl ${base}/models`} />
      </Section>

      <Section title="Chat Completions">
        <EndpointBlock method="POST" path="/v1/chat/completions" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          Drop-in replacement for OpenAI's <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">POST /v1/chat/completions</code>. Supports streaming, tool calls, and multi-turn conversations.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-medium">Non-streaming example:</p>
          <CodeBlock code={`curl ${base}/chat/completions \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-6",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">SSE Streaming:</p>
          <CodeBlock code={`curl ${base}/chat/completions \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5.2",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'`} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Tool Calling:</p>
          <CodeBlock code={`curl ${base}/chat/completions \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-6",
    "messages": [
      {"role": "user", "content": "What is the weather in Beijing?"}
    ],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get the current weather for a city",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {"type": "string"}
          },
          "required": ["city"]
        }
      }
    }]
  }'`} />
        </div>
      </Section>

      <Section title="SDK Integration">
        <p className="text-sm text-muted-foreground">Use any OpenAI-compatible SDK — just change the base URL.</p>
        <div className="space-y-2">
          <p className="text-sm font-medium">Python (openai SDK):</p>
          <CodeBlock code={`from openai import OpenAI

client = OpenAI(
    base_url="${window.location.origin}/api/v1",
    api_key="any-value",  # not needed
)

resp = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)`} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">JavaScript / TypeScript:</p>
          <CodeBlock code={`import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${window.location.origin}/api/v1",
  apiKey: "any-value",
  dangerouslyAllowBrowser: true,
});

const stream = await client.chat.completions.create({
  model: "gpt-5.2",
  messages: [{ role: "user", content: "Hello!" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`} />
        </div>
      </Section>

      <Section title="Parameters">
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Parameter</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["model", "string", "Model ID (see supported models)"],
                ["messages", "array", "Array of message objects with role and content"],
                ["stream", "boolean", "Enable SSE streaming (default: false)"],
                ["tools", "array", "OpenAI-format tool/function definitions"],
                ["tool_choice", "string|object", "Tool selection strategy"],
                ["max_tokens", "integer", "Maximum output tokens"],
                ["temperature", "number", "Sampling temperature 0–2"],
                ["top_p", "number", "Nucleus sampling threshold"],
              ].map(([param, type, desc]) => (
                <tr key={param} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{param}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{type}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

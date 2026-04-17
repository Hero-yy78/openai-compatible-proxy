import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const router: IRouter = Router();

const ANTHROPIC_MODELS = new Set([
  "claude-opus-4-6",
  "claude-opus-4-5",
  "claude-opus-4-1",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
]);

function getAnthropicClient(): Anthropic {
  const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("Anthropic integration env vars are not configured");
  }
  return new Anthropic({ baseURL, apiKey });
}

function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("OpenAI integration env vars are not configured");
  }
  return new OpenAI({ baseURL, apiKey });
}

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content:
    | string
    | null
    | Array<{
        type: string;
        text?: string;
        image_url?: { url: string };
        tool_use_id?: string;
      }>;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

type OpenAITool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

function openAIMessagesToAnthropic(
  messages: OpenAIMessage[],
  systemPrompt: string | null
): {
  system: string | undefined;
  messages: Anthropic.MessageParam[];
} {
  let system: string | undefined = systemPrompt ?? undefined;
  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      system = typeof msg.content === "string" ? msg.content : system;
      continue;
    }

    if (msg.role === "tool") {
      const lastMsg = anthropicMessages[anthropicMessages.length - 1];
      const toolResultContent: Anthropic.ToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: msg.tool_call_id ?? "",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      };
      if (lastMsg && lastMsg.role === "user") {
        if (Array.isArray(lastMsg.content)) {
          (lastMsg.content as Anthropic.ContentBlockParam[]).push(toolResultContent);
        } else {
          lastMsg.content = [toolResultContent];
        }
      } else {
        anthropicMessages.push({ role: "user", content: [toolResultContent] });
      }
      continue;
    }

    if (msg.role === "assistant") {
      const contentBlocks: Anthropic.ContentBlockParam[] = [];

      if (typeof msg.content === "string" && msg.content) {
        contentBlocks.push({ type: "text", text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            contentBlocks.push({ type: "text", text: block.text });
          }
        }
      }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          } catch {
            input = {};
          }
          contentBlocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input,
          } as Anthropic.ToolUseBlockParam);
        }
      }

      anthropicMessages.push({
        role: "assistant",
        content: contentBlocks.length > 0 ? contentBlocks : "",
      });
      continue;
    }

    if (msg.role === "user") {
      if (typeof msg.content === "string") {
        anthropicMessages.push({ role: "user", content: msg.content });
      } else if (Array.isArray(msg.content)) {
        const blocks: Anthropic.ContentBlockParam[] = [];
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            blocks.push({ type: "text", text: block.text });
          } else if (block.type === "image_url" && block.image_url) {
            const url = block.image_url.url;
            if (url.startsWith("data:")) {
              const [mediaTypePart, base64Data] = url.split(",");
              const mediaType = mediaTypePart?.split(":")[1]?.split(";")[0] as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp";
              blocks.push({
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64Data ?? "" },
              });
            } else {
              blocks.push({
                type: "image",
                source: { type: "url", url },
              } as unknown as Anthropic.ContentBlockParam);
            }
          }
        }
        anthropicMessages.push({ role: "user", content: blocks });
      }
    }
  }

  return { system, messages: anthropicMessages };
}

function openAIToolsToAnthropic(tools: OpenAITool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? "",
    input_schema: (t.function.parameters ?? { type: "object", properties: {} }) as Anthropic.Tool["input_schema"],
  }));
}

function anthropicStopReasonToOpenAI(reason: string | null): string {
  if (reason === "end_turn") return "stop";
  if (reason === "tool_use") return "tool_calls";
  if (reason === "max_tokens") return "length";
  return "stop";
}

async function handleAnthropicStream(
  req: Request,
  res: Response,
  body: {
    model: string;
    messages: OpenAIMessage[];
    tools?: OpenAITool[];
    tool_choice?: unknown;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    system?: string;
  }
) {
  const anthropic = getAnthropicClient();

  const { system, messages: anthropicMessages } = openAIMessagesToAnthropic(
    body.messages,
    body.system ?? null
  );

  const params: Anthropic.MessageStreamParams = {
    model: body.model,
    max_tokens: body.max_tokens ?? 8192,
    messages: anthropicMessages,
  };

  if (system) params.system = system;
  if (body.temperature !== undefined) params.temperature = body.temperature;
  if (body.top_p !== undefined) params.top_p = body.top_p;
  if (body.tools && body.tools.length > 0) {
    params.tools = openAIToolsToAnthropic(body.tools);
  }

  const requestId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendChunk = (delta: Record<string, unknown>, finishReason: string | null = null) => {
    const chunk = {
      id: requestId,
      object: "chat.completion.chunk",
      created,
      model: body.model,
      choices: [
        {
          index: 0,
          delta,
          finish_reason: finishReason,
        },
      ],
    };
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  try {
    const stream = anthropic.messages.stream(params);

    let currentToolCallId: string | null = null;
    let currentToolCallName: string | null = null;

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "text") {
          sendChunk({ role: "assistant", content: "" });
        } else if (event.content_block.type === "tool_use") {
          currentToolCallId = event.content_block.id;
          currentToolCallName = event.content_block.name;
          sendChunk({
            role: "assistant",
            content: null,
            tool_calls: [
              {
                index: event.index,
                id: currentToolCallId,
                type: "function",
                function: {
                  name: currentToolCallName,
                  arguments: "",
                },
              },
            ],
          });
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          sendChunk({ content: event.delta.text });
        } else if (event.delta.type === "input_json_delta") {
          sendChunk({
            tool_calls: [
              {
                index: event.index,
                function: {
                  arguments: event.delta.partial_json,
                },
              },
            ],
          });
        }
      } else if (event.type === "message_delta") {
        const finishReason = anthropicStopReasonToOpenAI(event.delta.stop_reason ?? null);
        sendChunk({}, finishReason);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    res.write(
      `data: ${JSON.stringify({ error: { message: errMsg, type: "api_error" } })}\n\n`
    );
    res.end();
  }
}

async function handleAnthropicNonStream(
  req: Request,
  res: Response,
  body: {
    model: string;
    messages: OpenAIMessage[];
    tools?: OpenAITool[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    system?: string;
  }
) {
  const anthropic = getAnthropicClient();

  const { system, messages: anthropicMessages } = openAIMessagesToAnthropic(
    body.messages,
    body.system ?? null
  );

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: body.model,
    max_tokens: body.max_tokens ?? 8192,
    messages: anthropicMessages,
  };

  if (system) params.system = system;
  if (body.temperature !== undefined) params.temperature = body.temperature;
  if (body.top_p !== undefined) params.top_p = body.top_p;
  if (body.tools && body.tools.length > 0) {
    params.tools = openAIToolsToAnthropic(body.tools);
  }

  const message = await anthropic.messages.create(params);

  const choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }> = [];

  let textContent = "";
  const toolCalls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }> = [];

  for (const block of message.content) {
    if (block.type === "text") {
      textContent += block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      });
    }
  }

  const choice: (typeof choices)[0] = {
    index: 0,
    message: {
      role: "assistant",
      content: textContent || null,
    },
    finish_reason: anthropicStopReasonToOpenAI(message.stop_reason),
  };

  if (toolCalls.length > 0) {
    choice.message.tool_calls = toolCalls;
  }

  choices.push(choice);

  res.json({
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices,
    usage: {
      prompt_tokens: message.usage.input_tokens,
      completion_tokens: message.usage.output_tokens,
      total_tokens: message.usage.input_tokens + message.usage.output_tokens,
    },
  });
}

async function handleOpenAIStream(
  req: Request,
  res: Response,
  body: {
    model: string;
    messages: OpenAIMessage[];
    tools?: OpenAITool[];
    tool_choice?: unknown;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    n?: number;
  }
) {
  const openai = getOpenAIClient();

  const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
    model: body.model,
    messages: body.messages as OpenAI.Chat.ChatCompletionMessageParam[],
    stream: true,
  };

  if (body.tools && body.tools.length > 0) {
    params.tools = body.tools as OpenAI.Chat.ChatCompletionTool[];
  }
  if (body.tool_choice !== undefined) {
    params.tool_choice = body.tool_choice as OpenAI.Chat.ChatCompletionToolChoiceOption;
  }
  if (body.temperature !== undefined) params.temperature = body.temperature;
  if (body.top_p !== undefined) params.top_p = body.top_p;
  if (body.n !== undefined) params.n = body.n;

  const isNewGen = /^(gpt-5|o4|o3)/.test(body.model);
  if (!isNewGen && body.max_tokens !== undefined) {
    (params as unknown as { max_tokens: number })["max_tokens"] = body.max_tokens;
  } else if (body.max_tokens !== undefined) {
    params.max_completion_tokens = body.max_tokens;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const stream = await openai.chat.completions.create(params);
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    res.write(
      `data: ${JSON.stringify({ error: { message: errMsg, type: "api_error" } })}\n\n`
    );
    res.end();
  }
}

async function handleOpenAINonStream(
  req: Request,
  res: Response,
  body: {
    model: string;
    messages: OpenAIMessage[];
    tools?: OpenAITool[];
    tool_choice?: unknown;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    n?: number;
  }
) {
  const openai = getOpenAIClient();

  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: body.model,
    messages: body.messages as OpenAI.Chat.ChatCompletionMessageParam[],
    stream: false,
  };

  if (body.tools && body.tools.length > 0) {
    params.tools = body.tools as OpenAI.Chat.ChatCompletionTool[];
  }
  if (body.tool_choice !== undefined) {
    params.tool_choice = body.tool_choice as OpenAI.Chat.ChatCompletionToolChoiceOption;
  }
  if (body.temperature !== undefined) params.temperature = body.temperature;
  if (body.top_p !== undefined) params.top_p = body.top_p;
  if (body.n !== undefined) params.n = body.n;

  const isNewGen = /^(gpt-5|o4|o3)/.test(body.model);
  if (!isNewGen && body.max_tokens !== undefined) {
    (params as unknown as { max_tokens: number })["max_tokens"] = body.max_tokens;
  } else if (body.max_tokens !== undefined) {
    params.max_completion_tokens = body.max_tokens;
  }

  const completion = await openai.chat.completions.create(params);
  res.json(completion);
}

router.post("/chat/completions", async (req, res) => {
  const body = req.body as {
    model: string;
    messages: OpenAIMessage[];
    stream?: boolean;
    tools?: OpenAITool[];
    tool_choice?: unknown;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    n?: number;
    system?: string;
  };

  if (!body.model) {
    res.status(400).json({
      error: {
        message: "model is required",
        type: "invalid_request_error",
        param: "model",
        code: "missing_param",
      },
    });
    return;
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    res.status(400).json({
      error: {
        message: "messages is required and must be an array",
        type: "invalid_request_error",
        param: "messages",
        code: "missing_param",
      },
    });
    return;
  }

  const isAnthropic = ANTHROPIC_MODELS.has(body.model);
  const isStream = body.stream === true;

  try {
    if (isAnthropic) {
      if (isStream) {
        await handleAnthropicStream(req, res, body);
      } else {
        await handleAnthropicNonStream(req, res, body);
      }
    } else {
      if (isStream) {
        await handleOpenAIStream(req, res, body);
      } else {
        await handleOpenAINonStream(req, res, body);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Chat completions error");

    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: errMsg,
          type: "api_error",
          code: "internal_error",
        },
      });
    }
  }
});

export default router;

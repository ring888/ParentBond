import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type AiProvider = "openai" | "claude" | "deepseek" | "mimo";
type Subject = "math" | "chinese" | "english" | "reading" | "other";

interface HomeworkTask {
  id: string;
  subject: Subject;
  title: string;
  estimatedMinutes: number;
  priority: 1 | 2 | 3;
  completedAt?: string | null;
}

interface LlmTaskParseResponse {
  tasks: HomeworkTask[];
  provider: string;
  latencyMs: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  async parseHomework(rawText: string, provider?: AiProvider): Promise<LlmTaskParseResponse> {
    const startedAt = Date.now();
    const selected = provider ?? this.config.get<AiProvider>("AI_DEFAULT_PROVIDER", "mimo");
    const prompt = this.buildTaskPrompt(rawText);

    try {
      const content = await this.callProvider(selected, prompt);
      const tasks = this.extractTasks(content);

      return {
        tasks,
        provider: selected,
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return {
        tasks: this.fallbackParse(rawText),
        provider: `${selected}:fallback`,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  private buildTaskPrompt(rawText: string): ChatMessage[] {
    return [
      {
        role: "system",
        content:
          "你是 ParentBond 的作业任务整理助手。只输出 JSON 数组，不要输出 Markdown，不要输出解释文字。",
      },
      {
        role: "user",
        content:
          "把孩子口语化描述整理成任务数组。每项必须包含 id, subject, title, estimatedMinutes, priority。subject 只能是 math, chinese, english, reading, other。estimatedMinutes 是分钟，取 5 到 90 的整数。priority 只能是 1, 2, 3，1 表示先做或更重要，3 表示轻松收尾。\n\n孩子原话：\n" +
          rawText,
      },
    ];
  }

  private async callProvider(provider: AiProvider, messages: ChatMessage[]) {
    if (provider === "claude") {
      return this.callClaude(messages);
    }

    return this.callOpenAiCompatible(provider, messages);
  }

  private async callOpenAiCompatible(
    provider: "openai" | "deepseek" | "mimo",
    messages: ChatMessage[],
  ) {
    const isOpenAi = provider === "openai";
    const isMimo = provider === "mimo";
    const apiKey = this.config.get<string>(
      isOpenAi ? "OPENAI_API_KEY" : isMimo ? "MIMO_API_KEY" : "DEEPSEEK_API_KEY",
    );

    if (!apiKey) {
      throw new Error(`${provider} api key is missing`);
    }

    const endpoint = isOpenAi
      ? "https://api.openai.com/v1/chat/completions"
      : isMimo
        ? `${this.config.get<string>("MIMO_BASE_URL", "https://api.xiaomimimo.com/v1").replace(/\/$/, "")}/chat/completions`
        : "https://api.deepseek.com/chat/completions";
    const model = this.config.get<string>(
      isOpenAi ? "OPENAI_MODEL" : isMimo ? "MIMO_MODEL" : "DEEPSEEK_MODEL",
      isOpenAi ? "gpt-4.1-mini" : isMimo ? "mimo-v2.5-pro" : "deepseek-chat",
    );
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (isMimo) {
      headers["api-key"] = apiKey;
    } else {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`${provider} failed with ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return json.choices?.[0]?.message?.content ?? "[]";
  }

  private async callClaude(messages: ChatMessage[]) {
    const apiKey = this.config.get<string>("CLAUDE_API_KEY");

    if (!apiKey) {
      throw new Error("claude api key is missing");
    }

    const model = this.config.get<string>("CLAUDE_MODEL", "claude-sonnet-4-6");
    const system = messages.find((message) => message.role === "system")?.content;
    const userMessages = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        temperature: 0.2,
        system,
        messages: userMessages,
      }),
    });

    if (!response.ok) {
      throw new Error(`claude failed with ${response.status}`);
    }

    const json = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    return json.content?.find((block) => block.type === "text")?.text ?? "[]";
  }

  private extractTasks(content: string): HomeworkTask[] {
    const cleaned = content.replace(/```(?:json)?/gi, "").trim();
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(arrayMatch?.[0] ?? objectMatch?.[0] ?? cleaned) as
      | Array<Partial<HomeworkTask>>
      | { tasks?: Array<Partial<HomeworkTask>> };
    const parsedTasks = Array.isArray(parsed) ? parsed : parsed.tasks;

    if (!Array.isArray(parsedTasks) || parsedTasks.length === 0) {
      throw new Error("MiMo returned no tasks");
    }

    return parsedTasks.slice(0, 8).map((task, index) => {
      const title = String(task.title ?? "未命名任务").slice(0, 120);
      const subject = this.normalizeSubject(task.subject);
      const estimatedMinutes = this.normalizeEstimatedMinutes(
        task.estimatedMinutes,
        title,
        subject,
      );

      return {
        id: task.id ?? `task-${index + 1}`,
        subject,
        title,
        estimatedMinutes,
        priority: this.normalizePriority(task.priority),
        completedAt: null,
      };
    });
  }

  private fallbackParse(rawText: string): HomeworkTask[] {
    const parts = rawText
      .split(/[，,。；;\n]/)
      .map((part) => part.trim())
      .filter(Boolean);

    const source = parts.length > 0 ? parts : [rawText.trim() || "整理今日作业"];

    return source.slice(0, 8).map((title, index) => {
      const subject = this.detectSubject(title);

      return {
        id: `fallback-${index + 1}`,
        subject,
        title,
        estimatedMinutes: this.estimateMinutes(title, subject),
        priority: title.includes("作文") || title.includes("重要") || title.includes("先做") ? 1 : 2,
        completedAt: null,
      };
    });
  }

  private detectSubject(title: string): Subject {
    if (/数学|计算|方程|口算|练习册/.test(title)) return "math";
    if (/语文|作文|日记|课文|阅读理解/.test(title)) return "chinese";
    if (/英语|单词|听写|unit|Unit/.test(title)) return "english";
    if (/阅读|课外书/.test(title)) return "reading";
    return "other";
  }

  private estimateMinutes(title: string, subject: Subject) {
    if (/作文|日记/.test(title)) return 45;
    if (/背诵|单词|听写/.test(title)) return 20;
    if (subject === "math") return 25;
    if (subject === "reading") return 30;
    return 20;
  }

  private normalizeSubject(subject?: HomeworkTask["subject"]): Subject {
    if (subject && ["math", "chinese", "english", "reading", "other"].includes(subject)) {
      return subject;
    }
    return "other";
  }

  private normalizePriority(priority?: HomeworkTask["priority"]): 1 | 2 | 3 {
    if (priority === 1 || priority === 2 || priority === 3) {
      return priority;
    }
    return 2;
  }

  private normalizeEstimatedMinutes(
    value: unknown,
    title: string,
    subject: Subject,
  ) {
    const minutes = Number(value ?? this.estimateMinutes(title, subject));

    if (!Number.isFinite(minutes)) {
      return this.estimateMinutes(title, subject);
    }

    return Math.min(90, Math.max(5, Math.round(minutes)));
  }
}

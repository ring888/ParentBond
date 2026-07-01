import type { HomeworkTask, Subject } from "@parentbond/shared";

const subjectStarters = [
  "数学",
  "语文",
  "英语",
  "阅读",
  "作文",
  "日记",
  "周记",
  "口算",
  "计算",
  "听写",
  "背诵",
  "预习",
  "复习",
  "练习",
] as const;

const taskVerbStarters = ["写", "读", "背", "做", "完成", "订正", "改错", "预习", "复习", "练习", "整理"] as const;

const chineseDigits: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function normalizeText(rawText: string) {
  return rawText
    .replace(/\r/g, "\n")
    .replace(/[：]/g, ":")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[　\t]+/g, " ")
    .replace(/\s*(然后|接着|另外|还有|还要|再做|再写|再读|再背)\s*/g, "\n")
    .replace(/(^|\n)\s*(\d+|[一二三四五六七八九十]+)[\.、)]\s*/g, "\n")
    .trim();
}

function looksLikeTaskStart(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return (
    subjectStarters.some((starter) => trimmed.startsWith(starter)) ||
    taskVerbStarters.some((starter) => trimmed.startsWith(starter)) ||
    /^(Unit|unit|U\d+|第.+课|课外书|生字|单词|古诗|课文)/.test(trimmed)
  );
}

function splitBySoftSeparators(segment: string) {
  const result: string[] = [];
  let current = "";

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    if (char === "," || char === "，" || char === "、") {
      const rest = segment.slice(index + 1);
      if (looksLikeTaskStart(rest)) {
        if (current.trim()) result.push(current.trim());
        current = "";
        continue;
      }
    }
    current += char;
  }

  if (current.trim()) result.push(current.trim());
  return result;
}

function splitTasks(rawText: string) {
  const normalized = normalizeText(rawText);
  const hardSegments = normalized
    .split(/[\n;；。！？!?]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return hardSegments
    .flatMap(splitBySoftSeparators)
    .map(cleanTitle)
    .filter(Boolean)
    .slice(0, 12);
}

function cleanTitle(title: string) {
  return title
    .replace(/^\s*[-*•·]\s*/, "")
    .replace(/^\s*(今天|今日|我要|需要|要完成|要做)\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function detectSubject(title: string): Subject {
  if (/英语|英文|单词|听写|默写|Unit|unit|U\d+/.test(title)) return "english";
  if (/数学|口算|计算|应用题|方程|竖式|奥数|练习册/.test(title)) return "math";
  if (/语文|作文|日记|周记|生字|拼音|古诗|课文|阅读理解|默写|背诵/.test(title)) return "chinese";
  if (/课外书|阅读|读书|摘抄/.test(title)) return "reading";
  return "other";
}

function parseChineseNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "半") return 0.5;
  if (value.length === 1) return chineseDigits[value] ?? Number.NaN;

  const tenIndex = value.indexOf("十");
  if (tenIndex >= 0) {
    const before = value.slice(0, tenIndex);
    const after = value.slice(tenIndex + 1);
    const tens = before ? chineseDigits[before] ?? 0 : 1;
    const ones = after ? chineseDigits[after] ?? 0 : 0;
    return tens * 10 + ones;
  }

  return Number.NaN;
}

function explicitMinutes(title: string) {
  const hourMatch = title.match(/([0-9]+|[一二两三四五六七八九十半]+)\s*(小时|个小时|h)/i);
  if (hourMatch) {
    const hours = parseChineseNumber(hourMatch[1]);
    if (Number.isFinite(hours)) return Math.round(hours * 60);
  }

  const minuteMatch = title.match(/([0-9]+|[一二两三四五六七八九十]+)\s*(分钟|分|min|mins|m\b)/i);
  if (minuteMatch) {
    const minutes = parseChineseNumber(minuteMatch[1]);
    if (Number.isFinite(minutes)) return Math.round(minutes);
  }

  return null;
}

function quantityHint(title: string) {
  const questionMatch = title.match(/(\d+)\s*(道|题)/);
  if (questionMatch) return Math.min(90, Math.max(10, Math.round(Number(questionMatch[1]) * 1.4)));

  const pageMatch = title.match(/(\d+)\s*页/);
  if (pageMatch) return Math.min(90, Math.max(15, Number(pageMatch[1]) * 8));

  const wordMatch = title.match(/(\d+)\s*(个)?单词/);
  if (wordMatch) return Math.min(60, Math.max(15, Math.round(Number(wordMatch[1]) * 0.8)));

  const articleMatch = title.match(/(\d+)\s*(篇|段)/);
  if (articleMatch) return Math.min(90, Math.max(20, Number(articleMatch[1]) * 25));

  return null;
}

function estimateMinutes(title: string, subject: Subject) {
  const explicit = explicitMinutes(title);
  if (explicit !== null) return clampMinutes(explicit);

  const quantity = quantityHint(title);
  if (quantity !== null) return clampMinutes(quantity);

  if (/作文|周记/.test(title)) return 45;
  if (/日记|摘抄/.test(title)) return 35;
  if (/背诵|默写|单词|听写/.test(title)) return 20;
  if (/订正|改错/.test(title)) return 15;
  if (subject === "math") return 25;
  if (subject === "reading") return 30;
  return 20;
}

function clampMinutes(minutes: number) {
  return Math.min(120, Math.max(1, Math.round(minutes)));
}

function detectPriority(title: string, subject: Subject): 1 | 2 | 3 {
  if (/先做|先写|优先|重要|明天交|今天交|考试|测验|听写|默写|作文/.test(title)) return 1;
  if (subject === "reading" || /预习|课外|选做|有时间/.test(title)) return 3;
  return 2;
}

export function parseHomeworkLocally(rawText: string): HomeworkTask[] {
  const titles = splitTasks(rawText);
  const source = titles.length > 0 ? titles : [cleanTitle(rawText) || "整理今日任务"];
  const createdAt = Date.now();

  return source.map((title, index) => {
    const subject = detectSubject(title);
    return {
      id: `local-${createdAt}-${index + 1}`,
      subject,
      title,
      estimatedMinutes: estimateMinutes(title, subject),
      priority: detectPriority(title, subject),
      completedAt: null,
    };
  });
}

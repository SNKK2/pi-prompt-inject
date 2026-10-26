/**
 * prompt-inject 扩展 —— 可开关的系统提示词注入
 *
 * /inject         弹出选择菜单(开启/关闭/编辑)
 * /inject on      开启
 * /inject off     关闭
 * /inject edit    编辑提示词
 *
 * 状态: ~/.pi/prompt-inject/state.json { enabled: boolean }
 * 提示词: ~/.pi/prompt-inject/prompt.md
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PI_HOME = join(homedir(), ".pi");
const INJECT_DIR = join(PI_HOME, "prompt-inject");
const STATE_FILE = join(INJECT_DIR, "state.json");
const PROMPT_FILE = join(INJECT_DIR, "prompt.md");

// ── 状态管理 ──────────────────────────────────────────────

interface State {
  enabled: boolean;
}

function readState(): State {
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    if (typeof parsed?.enabled === "boolean") return { enabled: parsed.enabled };
  } catch {
    // 文件不存在或解析失败，默认关闭
  }
  return { enabled: false };
}

function writeState(state: State): void {
  mkdirSync(INJECT_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

// ── 提示词加载 ────────────────────────────────────────────

function loadPrompt(): string {
  try {
    return readFileSync(PROMPT_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

// ── 官方身份句剥离 ────────────────────────────────────────

const STRIP_PATTERNS = [
  /You are an expert coding assistant operating inside pi, a coding agent harness\.\s*/g,
  /You are Claude Code, Anthropic's official CLI for Claude\.?\s*/g,
  /You are Claude,?[^\n]*\n?/g,
  /You are an AI agent powered by DeepSeek Harness\.?\s*/g,
  /You are a coding agent powered by the [^\n]+ model\.?\s*/g,
  /You are a helpful software engineer assistant\.?\s*/gi,
  /你是一个有帮助的软件工程师助手[。.]?\s*/g,
];

function stripOfficial(text: string): string {
  let out = text;
  for (const p of STRIP_PATTERNS) out = out.replace(p, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

// ── 命令处理函数 ──────────────────────────────────────────

function doOn(ctx: any) {
  if (!existsSync(PROMPT_FILE)) {
    ctx.ui.notify("请先创建提示词: /inject edit", "warning");
    return;
  }
  const prompt = loadPrompt();
  if (!prompt) {
    ctx.ui.notify("提示词文件为空，请先 /inject edit", "warning");
    return;
  }
  writeState({ enabled: true });
  ctx.ui.notify(`注入已开启 (${prompt.length} 字符)，下次对话生效`, "info");
}

function doOff(ctx: any) {
  writeState({ enabled: false });
  ctx.ui.notify("注入已关闭，下次对话恢复原样", "info");
}

async function doEdit(ctx: any) {
  const existing = loadPrompt();
  const edited = await ctx.ui.editor("编辑注入提示词", existing || "");
  if (edited !== undefined) {
    mkdirSync(INJECT_DIR, { recursive: true });
    writeFileSync(PROMPT_FILE, edited, "utf8");
    ctx.ui.notify("已保存。用 /inject on 开启注入", "info");
  }
}

// ── Extension 入口 ────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ★ 核心 hook：每次对话开始前检查开关
  pi.on("before_agent_start", (event) => {
    const state = readState();
    if (!state.enabled) return undefined;

    const inject = loadPrompt();
    if (!inject) return undefined;

    // 注入置顶 + 剥离官方身份句 + 保留剩余内容(工具列表、工作目录等)
    const stripped = stripOfficial(event.systemPrompt);
    const newPrompt = `${inject}\n\n${stripped}`;

    return { systemPrompt: newPrompt };
  });

  // 命令注册
  pi.registerCommand("inject", {
    description: "提示词注入开关: on | off | edit",
    handler: async (args: string, ctx) => {
      const [sub] = args.trim().split(/\s+/);

      // 无参数 → 弹选择菜单
      if (!sub) {
        if (!ctx.hasUI) {
          ctx.ui.notify("用法: /inject on | off | edit", "info");
          return;
        }
        const state = readState();
        const tag = state.enabled ? " ✓" : "";
        const choice = await ctx.ui.select("提示词注入", [
          `开启注入${state.enabled ? tag : ""}`,
          `关闭注入${!state.enabled ? tag : ""}`,
          `编辑提示词`,
        ]);
        if (choice === `开启注入${state.enabled ? tag : ""}`) return doOn(ctx);
        if (choice === `关闭注入${!state.enabled ? tag : ""}`) return doOff(ctx);
        if (choice === "编辑提示词") return doEdit(ctx);
        return;
      }

      // 带参数直接执行
      switch (sub) {
        case "on": return doOn(ctx);
        case "off": return doOff(ctx);
        case "edit": return doEdit(ctx);
        default:
          ctx.ui.notify("用法: /inject on | off | edit", "info");
      }
    },
  });
}

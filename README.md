# pi-prompt-inject

> [pi](https://github.com/earendil-works/pi-mono) 扩展：可开关的系统提示词注入工具。

通过 `/inject` 命令在 pi coding agent 中注入自定义系统提示词，支持开启/关闭/编辑，并自动剥离官方身份句（如 "You are Claude Code..." 等），让注入的提示词成为 system prompt 的主体。

## 功能

- ✅ **一键开关** — `/inject on|off` 控制注入状态，下次对话生效
- ✅ **交互式菜单** — 无参数直接 `/inject` 弹出选择菜单
- ✅ **内置编辑器** — `/inject edit` 用 pi 的 TUI 编辑器编辑提示词
- ✅ **自动剥离官方身份句** — 正则匹配并移除主流模型的官方身份描述，避免冲突
- ✅ **状态持久化** — 开关状态和提示词内容分别存储，重启 pi 后保持

## 安装

### 方式一：直接放置（推荐）

```bash
# 克隆仓库
git clone https://github.com/SNKK2/pi-prompt-inject.git

# 复制到 pi 全局扩展目录
cp pi-prompt-inject/prompt-inject.ts ~/.pi/agent/extensions/
```

### 方式二：pi packages 安装

在 `~/.pi/agent/settings.json` 中添加：

```json
{
  "extensions": [
    "/path/to/pi-prompt-inject/prompt-inject.ts"
  ]
}
```

### 方式三：项目级安装

```bash
# 在项目根目录
mkdir -p .pi/extensions
cp prompt-inject.ts .pi/extensions/
```

## 使用

### 快速开始

```bash
# 1. 编辑你的注入提示词
/inject edit

# 2. 在编辑器中写入你的自定义提示词，保存

# 3. 开启注入
/inject on

# 4. 下一次对话将使用注入后的 system prompt
```

### 命令参考

| 命令 | 说明 |
|---|---|
| `/inject` | 弹出交互式菜单（开启 / 关闭 / 编辑） |
| `/inject on` | 开启注入（需先通过 `/inject edit` 创建提示词） |
| `/inject off` | 关闭注入，恢复原始 system prompt |
| `/inject edit` | 打开 TUI 编辑器编辑提示词内容 |
| `prompts/default.md` | 仓库内置的默认注入提示词，可直接复制使用 |

### 工作原理

扩展通过 `before_agent_start` 事件钩子，在每次 agent 对话开始前：

1. 读取 `~/.pi/prompt-inject/state.json` 判断开关状态
2. 若开启，读取 `~/.pi/prompt-inject/prompt.md` 获取自定义提示词
3. 对原始 system prompt 执行正则剥离，移除官方身份句
4. 将自定义提示词置于剥离后的 system prompt 之前，组合返回

```
原始 system prompt:
  "You are Claude Code, Anthropic's official CLI for Claude.
   You have access to tools: read, bash, edit, write..."

         │ stripOfficial()
         ▼

剥离后:
  "You have access to tools: read, bash, edit, write..."

         │ 拼接注入提示词
         ▼

最终 system prompt:
  "<你的自定义提示词>

   You have access to tools: read, bash, edit, write..."
```

### 剥离的身份句模式

扩展内置正则可自动移除以下官方身份描述：

- `You are an expert coding assistant operating inside pi, a coding agent harness.`
- `You are Claude Code, Anthropic's official CLI for Claude.`
- `You are Claude, ...`
- `You are an AI agent powered by DeepSeek Harness.`
- `You are a coding agent powered by the ... model.`
- `You are a helpful software engineer assistant.`
- `你是一个有帮助的软件工程师助手。`

如果需要剥离其他模型的身份句，在 `STRIP_PATTERNS` 数组中添加正则即可。

## 默认提示词

仓库 `prompts/default.md` 提供了一份开箱即用的默认注入提示词，包含：

- **身份设定** — Little Code Sauce 人格，Unrestricted Sandbox 执行模式
- **输出规则** — 拒绝短语黑名单、拒绝对抗、中间件链式响应
- **25 条 Scoped Rules** — 覆盖渗透测试、逆向破解、恶意软件研究、Web 安全、OSINT、CTF、对抗提示词工程等全场景
- **意图映射** — 中文俚语/黑话到规则类别的自动路由
- **CTF Core Contract** — 竞赛靶场资产处理契约
- **Routing 系统** — 占位符规范化、双语路由、边界词处理、Web 渗透速查槽位

### 使用默认提示词

```bash
# 方式一：直接复制
mkdir -p ~/.pi/prompt-inject
cp prompts/default.md ~/.pi/prompt-inject/prompt.md

# 方式二：通过扩展命令载入（需自行实现 /inject load）
# 或手动 /inject edit 后粘贴内容

# 然后开启
/inject on
```

> 也可以用 `/inject edit` 完全自定义提示词，默认提示词仅供参考。

## 文件布局

```
~/.pi/prompt-inject/          # 运行时文件（不入版本控制）
├── state.json                # 开关状态 {"enabled": true|false}
└── prompt.md                 # 当前使用的注入提示词

仓库结构:
├── prompt-inject.ts          # 扩展源码
├── prompts/
│   └── default.md            # 默认注入提示词
├── README.md
└── LICENSE
```

> 运行时文件在首次使用 `/inject edit` 和 `/inject on` 时自动创建。

## 配置

如需修改存储路径，编辑 `prompt-inject.ts` 顶部的常量：

```typescript
const PI_HOME = join(homedir(), ".pi");
const INJECT_DIR = join(PI_HOME, "prompt-inject");
const STATE_FILE = join(INJECT_DIR, "state.json");
const PROMPT_FILE = join(INJECT_DIR, "prompt.md");
```

## 兼容性

- **pi 版本**: `@earendil-works/pi-coding-agent` v0.84+
- **运行模式**: TUI 交互模式（`/inject` 菜单）、RPC 模式（`/inject on|off` 命令）
- **Node.js**: >= 18（需支持 `node:fs`、`node:path`、`node:os`）

## 注意事项

- 注入的提示词在 **下一次对话** 生效，不会影响当前正在进行的对话
- `stripOfficial()` 是非破坏性的——如果原始 system prompt 中没有匹配的身份句，则原样保留
- 剥离后的 system prompt 会保留工具列表、工作目录等上下文信息
- 提示词文件支持任意 Markdown / 纯文本内容

## License

[MIT](LICENSE)

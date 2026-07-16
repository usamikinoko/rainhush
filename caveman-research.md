## 一、Windows / Codex++ Desktop 安装

### 1.1 克隆仓库并运行安装脚本

```powershell
git clone https://github.com/JuliusBrussee/caveman.git
cd caveman
.\install.ps1
```

`install.ps1` 是安装器的 PowerShell 薄壳，实际逻辑在 `bin/install.js` 中。该脚本自动检测系统中已安装的 AI 编码代理，对 Codex 的检测逻辑位于 `PROVIDERS` 数组：

定位到 `bin/install.js`，定义如下：

```javascript
const PROVIDERS = [
  // ...
  { id: 'codex', label: 'Codex CLI', mech: 'npx skills add (codex)',
    detect: 'command:codex', profile: 'codex' },
  // ...
];
```

当系统 PATH 中检测到 `codex` 命令时，安装器会调用 `installViaSkills` 函数，执行 `npx skills add JuliusBrussee/caveman -a codex`，将 7 个技能写入 `.agents/skills/` 目录下。

成功安装后输出：

```
Installed 7 skills
  ✓ caveman
  ✓ cavecrew
  ✓ caveman-commit
  ✓ caveman-compress
  ✓ caveman-help
  ✓ caveman-review
  ✓ caveman-stats
```

### 1.2 迁移到 Codex++ Desktop

`npx skills add` 写入的目标是 **Codex CLI** 的配置路径，而 **Codex++ Desktop** 从 `$CODEX_HOME/skills/` 加载技能，默认位置为 `C:\Users\<用户名>\.codex\skills\`。需手动将 7 个技能目录从 CLI 配置目录复制到 Desktop 配置目录：

```powershell
# caveman 仓库根目录下执行
Copy-Item -Path ".\.agents\skills\caveman" `
          -Destination "$env:USERPROFILE\.codex\skills\caveman" -Recurse -Force
Copy-Item -Path ".\.agents\skills\cavecrew" `
          -Destination "$env:USERPROFILE\.codex\skills\cavecrew" -Recurse -Force
Copy-Item -Path ".\.agents\skills\caveman-commit" `
          -Destination "$env:USERPROFILE\.codex\skills\caveman-commit" -Recurse -Force
Copy-Item -Path ".\.agents\skills\caveman-compress" `
          -Destination "$env:USERPROFILE\.codex\skills\caveman-compress" -Recurse -Force
Copy-Item -Path ".\.agents\skills\caveman-help" `
          -Destination "$env:USERPROFILE\.codex\skills\caveman-help" -Recurse -Force
Copy-Item -Path ".\.agents\skills\caveman-review" `
          -Destination "$env:USERPROFILE\.codex\skills\caveman-review" -Recurse -Force
Copy-Item -Path ".\.agents\skills\caveman-stats" `
          -Destination "$env:USERPROFILE\.codex\skills\caveman-stats" -Recurse -Force
```

> `$env:USERPROFILE\.codex\skills\` 有权限保护，需以管理员身份运行或通过 UAC 提权。

重启 Codex++ Desktop 后，在对话中输入 `caveman mode`，若模型回复变得紧凑精简，即表示安装成功。

## 二、Codex++ Desktop 中的使用

### 2.1 激活与关闭

Caveman 设计为"一次触发，全程生效"，无需每条 Prompt 前重复指令：

| 命令 / 短语 | 作用 |
|---|---|
| `caveman mode` | 激活默认 `full` 级别 |
| `talk like caveman` | 同上（自然语言触发） |
| `less tokens` / `be brief` | 同上 |
| `stop caveman` / `normal mode` | 关闭 Caveman |

激活后所有后续回复自动精简。**代码、commit、PR 正文不受影响。**

### 2.2 强度级别

```
/caveman          # full（默认）
/caveman lite     # 轻度——去填充词，保留完整句子
/caveman ultra    # 极端——仅保留核心信息
```

以 React 重渲染问题为例，四种输出风格的对比：

| 级别 | 回复 |
|---|---|
| Normal | "Your component re-renders because you create a new object reference each render. Wrap it in `useMemo`." |
| `lite` | "Wrap object in `useMemo`. New ref created every render." |
| `full` | "New ref each render. Wrap `useMemo`." |
| `ultra` | "New ref/render. `useMemo` it." |

### 2.3 子技能命令一览

| 命令 | 功能 |
|---|---|
| `/caveman-commit` | 生成 Conventional Commit 格式的 commit message（主题行 ≤50 字） |
| `/caveman-review` | 精简代码审查：`L42: 🔴 bug: user null. Add guard.` |
| `/caveman-stats` | 读取会话日志，显示 Token 消耗与实际节省量 |
| `/caveman-compress <file>` | 压缩记忆文件（如 CLAUDE.md），每次会话加载时省约 46% 输入 Token |
| `/caveman-help` | 所有命令的速查卡 |
| `cavecrew` | 派生子代理（investigator/builder/reviewer），子代理输出同样压缩 |

### 2.4 使用要点

- **一次触发，全程生效。** 会话开始时说一次 `caveman mode` 即可。
- **中途调级。** 若某步过于精简导致不清晰，切到 `lite` 即可，无需关闭。
- **自动安全模式。** 涉及安全警告、不可逆操作、多步骤关键流程时，Caveman 自动恢复完整语气，安全区域过后恢复精简。

---

## 三、降低 Token 消耗的实现原理

Caveman 的核心机制是 **System Prompt 级别的输出压缩指令**。它不修改模型权重，不压缩输入数据，而是通过注入规则让模型主动缩短输出文本。以下按源码文件逐一分析。

### 3.1 核心规则定义：`skills/caveman/SKILL.md`

这是 Caveman 所有行为的单点真相（Single Source of Truth）。所有代理、所有平台加载的都是同一份文件。定位到仓库根目录下的 `skills/caveman/SKILL.md`：

```yaml
---
name: caveman
description: >
  Ultra-compressed communication mode. Cuts output tokens 65% (measured)
  by speaking like caveman while keeping full technical accuracy.
---
```

文件的核心指令只有一句：

```markdown
Respond terse like smart caveman. All technical substance stay. Only fluff die.
```

随后是具体的规则集，分为几个层次。（为聚焦关键逻辑，下文的规则以精简版呈现；完整规则见源文件。）

**第一层：持久性声明**

```markdown
ACTIVE EVERY RESPONSE. No revert after many turns. No filler drift.
Still active if unsure. Off only: "stop caveman" / "normal mode".
```

这段声明告诉模型：不要因为对话变长就逐渐"遗忘"压缩指令；不要因为不确定是否还处于 Caveman 模式就恢复啰嗦。这是对抗 LLM 上下文漂移（context drift）的关键设计。

**第二层：词汇层面的精简规则**

```markdown
Drop: articles (a/an/the), filler (just/really/basically/actually/simply),
pleasantries (sure/certainly/of course/happy to), hedging.
Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for").
```

这份规则集本质上是一个**针对输出端的语法简并化约束**。它在不丢失信息量的前提下，将自然语言中的"冗余语料"全部剥除：

- **冠词（a/an/the）**：英语中完全由语法规则强制要求的成分，对语义理解无贡献
- **填充词**：just, really, basically, actually, simply——口语化表达，对技术说明无信息增量
- **礼貌语**：sure, certainly, of course, happy to——社交性语句，不是技术内容
- **模糊用语**：perhaps, maybe, might——不确定性的标记词，工程场景中通常可用确定性替代
- **短同义词**：big 替代 extensive，fix 替代 implement a solution for——减少词长不等同于减少信息

**第三层：不受保护的内容类型**

```markdown
Technical terms exact. Code blocks unchanged. Errors quoted exact.
```

```markdown
ALWAYS keep technical terms, code, API names, CLI commands,
commit-type keywords (feat/fix/...), and exact error strings verbatim.
```

这里定义了一个关键的**保真约束**：压缩只作用于自然语言描述，不对代码、命令、API 名称等结构化内容做任何修改。这是 Caveman "不损失技术准确性"的保障机制。

**第四层：强度级别的规则差异**

定位到同一文件中，强度表格定义了从 `lite` 到 `ultra` 的不同压缩深度：

```markdown
| Level | What change |
|-------|------------|
| lite  | No filler/hedging. Keep articles + full sentences. Professional but tight |
| full  | Drop articles, fragments OK, short synonyms. Classic caveman. |
| ultra | Strip conjunctions when cause-then-effect stay unambiguous. One word when one word enough. |
```

三种级别的差异关键在于**约束力度的递增**：`lite` 仅去除填充词和模糊用语，`full` 进一步去除冠词并允许片段句，`ultra` 则将连词也一并去除，只要因果关系不产生歧义即可。

**总结**：`SKILL.md` 本质上是一个用 Markdown 书写的、面向 LLM 的压缩约束语言。它通过持久性声明对抗上下文漂移，通过词汇黑白名单控制压缩边界，通过保真约束保护代码等结构化内容，通过强度分级提供可调的压缩深度。

### 3.2 会话启动注入（SessionStart）：`src/hooks/caveman-activate.js`

对于支持 Hook 系统的代理（Claude Code 等），Caveman 在会话启动时通过 SessionStart Hook 注入完整规则集。定位到 `src/hooks/caveman-activate.js`：

写入模式标记文件：

```javascript
// caveman-activate.js: 写入模式标记
const mode = getDefaultMode();
safeWriteFlag(flagPath, mode);
```

`getDefaultMode()` 的优先级链位于 `caveman-config.js`，定位到 `src/hooks/caveman-config.js`：

```javascript
function getDefaultMode() {
  // 1. 环境变量（最高优先级）
  const envMode = process.env.CAVEMAN_DEFAULT_MODE;
  if (envMode && VALID_MODES.includes(envMode.toLowerCase())) {
    return envMode.toLowerCase();
  }
  // 2. 仓库级配置（check-in 到代码仓库中）
  const repoConfigPath = findRepoConfigPath(process.cwd());
  if (repoConfigPath) { /* ... */ }
  // 3. 用户级配置（~/.config/caveman/config.json）
  const userMode = readModeFromConfigFile(getConfigPath());
  if (userMode) return userMode;
  // 4. 默认值
  return 'full';
}
```

这套优先级设计允许三种粒度的配置：全局环境变量覆盖所有项目，仓库级配置让团队成员共享默认模式，用户级配置用作个人偏好。

接着，`caveman-activate.js` 动态读取 SKILL.md 并按当前模式过滤强度表格：

```javascript
// caveman-activate.js: 按当前模式过滤规则表
const body = skillContent.replace(/^---[\s\S]*?---\s*/, '');

const filtered = body.split('\n').reduce((acc, line) => {
  const tableRowMatch = line.match(/^\|\s*\*\*(\S+?)\*\*\s*\|/);
  if (tableRowMatch) {
    // 只保留当前模式的强度行
    if (tableRowMatch[1] === modeLabel) acc.push(line);
    return acc;
  }
  // 只保留当前模式的示例行
  const exampleMatch = line.match(/^- (\S+?):\s/);
  if (exampleMatch) {
    if (exampleMatch[1] === modeLabel) acc.push(line);
    return acc;
  }
  acc.push(line);
  return acc;
}, []);
```

这段代码实现了**按强度级别过滤规则**：只将当前模式的规则行和示例注入上下文，避免不相关规则占用上下文空间。过滤后的规则文本写入 stdout，由 Claude Code 作为系统上下文注入。

### 3.3 每轮强化（UserPromptSubmit）：`src/hooks/caveman-mode-tracker.js`

在一个长会话中，其他插件和工具的指令不断涌入，Caveman 的初始规则可能被推到上下文边缘。`caveman-mode-tracker.js` 在每个用户 Prompt 提交时注入一则简短的结构化提醒，定位到 `src/hooks/caveman-mode-tracker.js`：

```javascript
// caveman-mode-tracker.js: 每轮强制提醒
if (activeMode && !INDEPENDENT_MODES.has(activeMode)) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: "CAVEMAN MODE ACTIVE (" + activeMode + "). " +
        "Drop articles/filler/pleasantries/hedging. Fragments OK. " +
        "Code/commits/security: write normal."
    }
  }));
}
```

这段提醒只包含规则的**极简摘要**（去冠词/去填充词/允许片段/代码正常写），而非完整规则集。它的目的是做一个"注意力锚点"，确保压缩要求在每轮都位于模型关注窗口的可见范围内。

同一文件中还实现了自然语言触发检测，例如 `"activate caveman"`, `"turn on caveman mode"`, `"less tokens"`, `"be brief"`, `"talk like caveman"` 等短语都无需 `/caveman` 也能触发模式切换。

### 3.4 Benchmark 测量体系：`benchmarks/run.py`

Caveman 的 65% 输出 Token 节省不是一个粗略的估算，而是通过标准化的 Benchmark 流程实际测量得到的。Benchmark 的执行入口位于 `benchmarks/run.py`。

该脚本定义了两个 System Prompt——一个是普通模式，一个是 Caveman 模式——对同一组 Prompt 分别调用 Claude API：

```python
# benchmarks/run.py: 核心对比逻辑
NORMAL_SYSTEM = "You are a helpful assistant."
SKILL_PATH = REPO_DIR / "skills" / "caveman" / "SKILL.md"

# 对每个 Prompt，分别用两种 System Prompt 调用 API
for mode, system in [("normal", NORMAL_SYSTEM), ("caveman", caveman_system)]:
    for t in range(1, trials + 1):
        result = call_api(client, model, system, prompt_text)
        entry[mode].append(result)

# 计算中位数和节省比例
normal_medians = statistics.median([t["output_tokens"] for t in entry["normal"]])
caveman_medians = statistics.median([t["output_tokens"] for t in entry["caveman"]])
savings = 1 - (caveman_medians / normal_medians) if normal_medians > 0 else 0
```

为什么每种模式跑 3 次取中位数？因为 LLM 的输出具有随机性——同一个 Prompt 两次调用的 Token 数可能不同。取中位数可以消除极端值（某次 API 调用恰好极短或极长）对结果的干扰。

Test Cases 覆盖了 10 个不同领域的编程场景，定义在 `benchmarks/prompts.json` 中：

```json
{
  "prompts": [
    { "id": "react-rerender", "category": "debugging",
      "prompt": "Why is my React component re-rendering..." },
    { "id": "auth-middleware-fix", "category": "bugfix",
      "prompt": "My Express auth middleware is letting expired JWT tokens through..." },
    { "id": "postgres-pool", "category": "setup",
      "prompt": "How do I set up a PostgreSQL connection pool in Node.js..." },
    { "id": "git-rebase-merge", "category": "explanation",
      "prompt": "Explain the difference between git rebase and git merge..." },
    { "id": "async-refactor", "category": "refactor",
      "prompt": "Refactor this callback-based Node.js function to use async/await..." },
    { "id": "microservices-monolith", "category": "architecture",
      "prompt": "We have a monolithic Django app that's getting slow..." },
    { "id": "pr-security-review", "category": "code-review",
      "prompt": "Review this Express route handler for security issues..." },
    { "id": "docker-multi-stage", "category": "devops",
      "prompt": "Write a multi-stage Dockerfile for a Node.js TypeScript application..." },
    { "id": "race-condition-debug", "category": "debugging",
      "prompt": "My Node.js API endpoint that increments a counter..." },
    { "id": "error-boundary", "category": "implementation",
      "prompt": "Implement a React error boundary component..." }
  ]
}
```

Benchmark 结果使用 `claude-sonnet-4-20250514` 模型，每种模式 3 轮取中位数，实测数据如下：

| 任务 | Normal (tokens) | Caveman (tokens) | 节省比例 |
|---|---|---|---|
| 解释 React 重渲染 bug | 1180 | 159 | 87% |
| 修复 Auth 中间件 Token 过期 | 704 | 121 | 83% |
| 设置 PostgreSQL 连接池 | 2347 | 380 | 84% |
| 解释 git rebase vs merge | 702 | 292 | 58% |
| Refactor 回调到 async/await | 387 | 301 | 22% |
| 微服务 vs 单体架构 | 446 | 310 | 30% |
| PR 安全审查 | 678 | 398 | 41% |
| Docker 多阶段构建 | 1042 | 290 | 72% |
| 调试 PostgreSQL 竞态条件 | 1200 | 232 | 81% |
| 实现 React Error Boundary | 3454 | 456 | 87% |
| **平均** | **1214** | **294** | **65%** |

数据范围 22%–87%。差距的原因在于任务性质：包含大量示例代码的任务（如"实现 React Error Boundary"），代码块本身不受压缩影响，但大段的解释文字被大幅削减；而代码比重极高的短回答任务（如"refactor 回调到 async/await"），输出中代码占大部分，可压缩的 Prose 空间有限。

### 3.5 数据边界与诚实说明：`docs/HONEST-NUMBERS.md`

Caveman 项目在 `docs/HONEST-NUMBERS.md` 中公开声明了其测量数据的适用范围与局限性。定位到此文件，关键内容如下：

```markdown
## When caveman wins

- Long chatty outputs — anywhere the model would write 1k+ output tokens
  per reply. This is where the 50-87% cuts happen.
- Long sessions with verbose agents. The per-reply savings compound;
  the fixed ~1-1.5k/turn rule cost stays flat.

## When caveman loses (net-negative)

- Terse coding Q&A. If your normal replies are ~150 output tokens, caveman
  saves maybe 70-100 of them and costs ~1k+ of input overhead per turn.
  Net loss.
- Session-level totals are always smaller than the output-reduction headline,
  because input tokens (your prompts, your context, your files, the injected
  rules) dwarf output tokens in agentic coding. Independent session-level
  measurements land around 14-21% total savings on output-heavy workloads —
  and below zero on terse ones.
- Agents that bill by request or credit, not tokens. GitHub Copilot charges
  premium requests. A shorter answer is the same request.

## Rule of thumb

> Normal reply longer than ~1.5-2k output tokens → caveman probably saves you money.
> Normal reply shorter than that, or you pay per request → caveman probably costs you money.
> Either way, caveman replies faster to read. That part is free.
```

这份文档的核心结论：

1. **Caveman 只节省输出 Token**。输入 Token（你的 Prompt、项目上下文、注入的规则文件）完全不变，且每轮额外消耗约 1-1.5k Token 用于注入规则。
2. **长输出场景显著受益**：当正常回复超过 1.5-2k Token 时，节省比例 50-87%。
3. **短输出场景可能净亏损**：正常回复仅 ~150 Token 时，节省 70-100 输出 Token，但规则注入消耗 1k+ 输入 Token——成本大于收益。
4. **全会话级节省远小于输出节省率**：因为输入 Token 远大于输出 Token，实际总节省通常在 14-21%。

### 3.6 Caveman-Compress：记忆文件的输入 Token 优化

除了运行时输出压缩，Caveman 还提供了一个独立的压缩子技能 `caveman-compress`，用于压缩静态记忆文件（如 `CLAUDE.md`、`todos.md`）。与运行时的行为指令不同，这是对文件内容的**离线修改**——压缩后文件变小，后续每次会话加载该文件时都能省掉约 46% 的输入 Token。

核心逻辑位于 `skills/caveman-compress/scripts/compress.py`。压缩流程：

```python
# compress.py: 压缩前置处理——分离 YAML 头
def split_frontmatter(text: str):
    m = FRONTMATTER_REGEX.match(text)
    if m:
        return m.group(1), m.group(2)
    return "", text

# compress.py: 压缩流程
frontmatter, body = split_frontmatter(original_text)
compressed_body = call_claude(build_compress_prompt(body))
compressed = frontmatter + compressed_body
```

YAML 头（frontmatter）为什么需要分离处理？因为 Claude 在压缩过程中倾向于改写或删除 YAML 元数据——尽管 preserve-structure 规则要求保留。解决方案是先将它切出，压缩完成后再原样拼接回去。

压缩后的文件经过验证（`validate.py`），检查代码块、URL、文件路径是否完整保留，验证失败的则调用 Claude 定向修复（不重新压缩，只修补具体问题），最多重试 2 次后恢复原文件。

Compress 的实测数据：

| 文件 | 原始 (bytes) | 压缩后 (bytes) | 节省 |
|---|---|---|---|
| claude-md-preferences.md | 706 | 285 | 59.6% |
| project-notes.md | 1145 | 535 | 53.3% |
| claude-md-project.md | 1122 | 636 | 43.3% |
| todo-list.md | 627 | 388 | 38.1% |
| mixed-with-code.md | 888 | 560 | 36.9% |
| **平均** | **898** | **481** | **46%** |

这是**一次性操作，永久收益**——压缩后的文件每次会话加载都比原始版本小 46%，输入 Token 节省随会话次数持续累积。

### 3.7 MCP Shrink：对中间件通信的压缩

Caveman 还提供 `caveman-shrink`，一个 MCP（Model Context Protocol）中间件。它作为代理卡在 MCP 客户端和上游 MCP 服务器之间，对服务器返回的 Tool/Prompt/Resource 列表中的 `description` 字段进行文本级压缩。定位到 `src/mcp-servers/caveman-shrink/` 目录。

代理入口 `index.js` 的核心逻辑：

```javascript
// caveman-shrink/index.js: 中间件主循环
function transformResponse(msg) {
  const r = msg.result;
  for (const arrayName of ['tools', 'prompts', 'resources', 'resourceTemplates']) {
    if (Array.isArray(r[arrayName])) {
      for (const item of r[arrayName]) {
        for (const field of fields) {
          if (typeof item[field] === 'string') {
            const { compressed } = compress(item[field]);
            if (compressed !== item[field]) {
              item[field] = compressed;
            }
          }
        }
      }
    }
  }
  return msg;
}
```

它拦截从上游服务器到客户端的 JSON-RPC 消息，遍历四个列表类型数组中的 `description` 字段，调用 `compress()` 进行压缩。

压缩器本身是一个纯 Node.js 实现（`compress.js`），不依赖 LLM，通过正则替换直接处理文本：

```javascript
// caveman-shrink/compress.js: 受保护的模式——压缩前先替换为占位符
const PROTECTED_PATTERNS = [
  /```[\s\S]*?```/g,                    // fenced code
  /`[^`\n]+`/g,                         // inline code
  /\bhttps?:\/\/\S+/gi,                 // URLs
  /[\w.-]*[\/\\][\w.\/\\\-]+/g,         // paths with / or \
  /[A-Z][A-Za-z0-9]*(?:_[A-Z][A-Za-z0-9]*)+\b/g, // CONST_CASE
  /\b\w+\.\w+(?:\.\w+)*\(\)?/g,         // dotted.method or pkg.fn()
  /[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)/g, // function calls
];
```

压缩的边界律（boundary rule）与 SKILL.md 一致——代码块、内联代码、URL、路径、函数名等结构化内容受保护，只有自然语言描述被压缩。具体的压缩函数：

```javascript
// caveman-shrink/compress.js: 文本压缩规则
function compressProse(text) {
  let s = text;
  s = s.replace(LEADERS, '');      // 去除句首引导词
  s = s.replace(PLEASANTRIES, '');  // 去除礼貌语
  s = s.replace(HEDGES, '');        // 去除模糊词
  s = s.replace(FILLERS, '');       // 去除填充词
  s = s.replace(ARTICLES, '');      // 去除冠词
  s = s.replace(/[ \t]{2,}/g, ' '); // 合并多余空白
  return s.trim();
}
```

压缩算法执行顺序的设计意图：

1. 先保护（`withProtectedSegments` 将受保护片段替换为占位符）
2. 再压缩（`compressProse` 对剩余文本逐层剥离冗余）
3. 最后还原（将占位符替换回原始内容）

五层剥离（引导词 → 礼貌语 → 模糊词 → 填充词 → 冠词）的顺序保证了：每一层剥离后的"空白残渣"由后续层的正则匹配到，最终 `collapse whitespace` 统一清理。

### 3.8 端到端流程总结

```
SessionStart Hook
  │
  ├── caveman-config.js: getDefaultMode() 决定当前模式
  ├── caveman-activate.js: 读取 SKILL.md → 按模式过滤 → 注入规则
  └── 写入 .caveman-active 标记文件
        │
        ▼
UserPromptSubmit Hook（每次用户输入触发）
  │
  ├── caveman-mode-tracker.js: 检测 /caveman / stop 等命令
  ├── 更新标记文件（模式切换或关闭）
  └── 注入 "CAVEMAN MODE ACTIVE" 每轮提醒
        │
        ▼
模型生成回复
  │
  ├── 遵守 SKILL.md 规则条生成输出
  ├── 代码块/c ommands/URLs 不变
  └── 输出 Token 减少平均 65%
        │
        ▼
/caveman-stats 读取会话日志
  └── 按模式归属计算实际节省量
```

整个过程无需网络请求，完全通过本地脚本和 Markdown 规则文件实现。

---

**参考资料**

- Caveman 仓库：https://github.com/JuliusBrussee/caveman
- 核心规则：`skills/caveman/SKILL.md`
- Hook 系统：`src/hooks/caveman-activate.js`、`caveman-mode-tracker.js`、`caveman-config.js`
- Benchmark：`benchmarks/run.py`、`benchmarks/prompts.json`
- 数据说明：`docs/HONEST-NUMBERS.md`
- 压缩器：`src/mcp-servers/caveman-shrink/compress.js`
- 离线压缩：`skills/caveman-compress/scripts/compress.py`

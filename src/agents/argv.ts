/**
 * md2wechat CLI 代理
 * 支持 9 种本地 coding-agent CLI 适配
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

// ==================== 类型定义 ====================

export interface AgentAdapter {
  id: string;
  name: string;
  detectionPaths: string[];
  buildArgv: (input: string) => string[];
  parseStream: (line: string) => StreamingChunk | null;
}

export interface StreamingChunk {
  html?: string;
  text?: string;
  done?: boolean;
  error?: string;
}

export interface DetectedAgent {
  id: string;
  name: string;
  installed: boolean;
  path?: string;
}

// ==================== PATH 扫描 ====================

const SEARCH_PATHS = [
  os.homedir() + "/.local/bin",
  os.homedir() + "/.bun/bin",
  os.homedir() + "/.npm-global/bin",
  "/opt/homebrew/bin",
  ...process.env.PATH?.split(path.delimiter) ?? [],
];

function findExecutable(name: string): string | null {
  for (const searchPath of SEARCH_PATHS) {
    const fullPath = path.join(searchPath, name);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

// ==================== CLI 适配器 ====================

const AGENTS: AgentAdapter[] = [
  {
    id: "claude",
    name: "Claude Code",
    detectionPaths: ["claude"],
    buildArgv: (input) => ["-p", "--output-format", "stream-json"],
    parseStream: (line: string): StreamingChunk | null => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "content_block_delta" || parsed.type === "text") {
          return { text: parsed.delta ?? parsed.text ?? "" };
        }
        if (parsed.type === "message_delta" || parsed.done) {
          return { done: true };
        }
        return null;
      } catch {
        return { text: line };
      }
    },
  },
  {
    id: "cursor",
    name: "Cursor Agent",
    detectionPaths: ["cursor-agent"],
    buildArgv: (input) => ["--print", "--output-format", "stream-json", "--force", "--trust"],
    parseStream: (line: string): StreamingChunk | null => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.content) {
          return { text: parsed.content };
        }
        return null;
      } catch {
        if (line.trim()) {
          return { text: line };
        }
        return null;
      }
    },
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    detectionPaths: ["gemini"],
    buildArgv: (input) => ["--output-format", "stream-json", "--yolo"],
    parseStream: (line: string): StreamingChunk | null => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.text) {
          return { text: parsed.text };
        }
        return null;
      } catch {
        return null;
      }
    },
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    detectionPaths: ["copilot"],
    buildArgv: (input) => ["--allow-all-tools", "--output-format", "json"],
    parseStream: (line: string): StreamingChunk | null => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) {
          return { text: parsed.message.content };
        }
        return null;
      } catch {
        return null;
      }
    },
  },
  {
    id: "opencode",
    name: "OpenCode",
    detectionPaths: ["opencode-cli", "opencode"],
    buildArgv: (input) => ["run", "--format", "json", "--dangerously-skip-permissions", "-"],
    parseStream: (line: string): StreamingChunk | null => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.response || parsed.text) {
          return { text: parsed.response ?? parsed.text };
        }
        return null;
      } catch {
        return null;
      }
    },
  },
  {
    id: "qwen",
    name: "Qwen Coder",
    detectionPaths: ["qwen"],
    buildArgv: (input) => ["--yolo", "-"],
    parseStream: (line: string): StreamingChunk | null => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.choices?.[0]?.delta?.content) {
          return { text: parsed.choices[0].delta.content };
        }
        return null;
      } catch {
        return null;
      }
    },
  },
  {
    id: "aider",
    name: "Aider",
    detectionPaths: ["aider"],
    buildArgv: (input) => ["--no-pretty", "--no-stream", "--yes-always", "--message-file", "-"],
    parseStream: (line: string): StreamingChunk | null => {
      if (line.startsWith("=")) return null;
      try {
        const parsed = JSON.parse(line);
        if (parsed.response) {
          return { text: parsed.response };
        }
        return null;
      } catch {
        return { text: line };
      }
    },
  },
  {
    id: "kimi",
    name: "Kimi Code",
    detectionPaths: ["kimi-code", "kimi"],
    buildArgv: (input) => ["--print"],
    parseStream: (line: string): StreamingChunk | null => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.text || parsed.content) {
          return { text: parsed.text ?? parsed.content };
        }
        return null;
      } catch {
        return null;
      }
    },
  },
  {
    id: "codex",
    name: "OpenAI Codex",
    detectionPaths: ["codex"],
    buildArgv: (input) => ["exec", "--json", "--sandbox", "workspace-write"],
    parseStream: (line: string): StreamingChunk | null => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.output) {
          return { text: parsed.output };
        }
        return null;
      } catch {
        return null;
      }
    },
  },
];

// ==================== 核心功能 ====================

/**
 * 检测已安装的 CLI
 */
export function detectAgents(): DetectedAgent[] {
  return AGENTS.map((agent) => {
    const foundPath = agent.detectionPaths.find((name) => findExecutable(name));
    return {
      id: agent.id,
      name: agent.name,
      installed: !!foundPath,
      path: foundPath ?? undefined,
    };
  });
}

/**
 * 获取指定 ID 的适配器
 */
export function getAgentAdapter(agentId: string): AgentAdapter | null {
  return AGENTS.find((a) => a.id === agentId) ?? null;
}

/**
 * 调用 CLI 并返回流式输出
 */
export function spawnAgentStream(
  agentId: string,
  systemPrompt: string,
  userInput: string,
  onChunk: (chunk: StreamingChunk) => void,
  onError: (err: Error) => void
): () => void {
  const adapter = getAgentAdapter(agentId);
  if (!adapter) {
    onError(new Error(`Unknown agent: ${agentId}`));
    return () => {};
  }

  // 构建消息内容
  const fullPrompt = `${systemPrompt}\n\n用户输入：\n${userInput}`;

  const argv = adapter.buildArgv(fullPrompt);
  const binPath = adapter.detectionPaths.find((name) => findExecutable(name)) ?? adapter.detectionPaths[0];

  const proc = spawn(binPath, argv, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  let killed = false;

  proc.stdout?.on("data", (data: Buffer) => {
    if (killed) return;
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = adapter.parseStream(line);
      if (chunk) {
        onChunk(chunk);
      }
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    if (killed) return;
    onChunk({ text: data.toString() });
  });

  proc.on("error", (err) => {
    if (!killed) {
      onError(err);
    }
  });

  proc.on("close", () => {
    if (!killed) {
      onChunk({ done: true });
    }
  });

  // 发送输入到 stdin
  proc.stdin?.write(fullPrompt);
  proc.stdin?.end();

  // 返回清理函数
  return () => {
    killed = true;
    if (!proc.killed) {
      proc.kill();
    }
  };
}
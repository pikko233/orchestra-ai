import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  stat,
  unlink,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  matchesGlob,
  relative,
  resolve,
  sep,
  win32,
} from "node:path";
import { tool, type ToolRuntime } from "langchain";
import z from "zod";
import type { AgentContextType } from "../memory/schema";

const IGNORED_DIRECTORIES = new Set([".git", ".next", "node_modules"]);
const MAX_GLOB_RESULTS = 200;
const MAX_GREP_RESULTS = 50;
const MAX_FILE_BYTES = 512_000;
const MAX_READ_CHARACTERS = 100_000;
const READ_TRUNCATION_NOTICE = "\n...文件内容已截断";
const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

type FileToolRuntime = ToolRuntime<unknown, AgentContextType>;

const pathSchema = z
  .string()
  .trim()
  .min(1)
  .describe("相对于当前项目工作区的文件路径");

function isInside(root: string, target: string) {
  const path = relative(root, target);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
}

async function resolveWorkspaceRoot(runtime: FileToolRuntime) {
  const { projectId, userId } = runtime.context ?? {};
  if (
    typeof userId !== "string" ||
    typeof projectId !== "string" ||
    !WORKSPACE_ID_PATTERN.test(userId) ||
    !WORKSPACE_ID_PATTERN.test(projectId)
  ) {
    throw new Error("无效的用户或项目工作区标识");
  }

  const configuredRoot = resolve(
    process.env.AGENT_WORKSPACE_ROOT ?? ".agent-workspaces",
  );
  await mkdir(configuredRoot, { recursive: true });
  const workspacesRoot = await realpath(configuredRoot);
  const userWorkspace = join(workspacesRoot, userId);
  await mkdir(userWorkspace, { recursive: true });
  const userRoot = await realpath(userWorkspace);
  if (!isInside(workspacesRoot, userRoot)) {
    throw new Error("无效的用户工作区路径");
  }

  const workspace = join(userRoot, projectId);
  await mkdir(workspace, { recursive: true });
  const root = await realpath(workspace);
  if (!isInside(userRoot, root)) throw new Error("无效的项目工作区路径");
  return root;
}

function resolveWorkspacePath(root: string, filePath: string) {
  if (isAbsolute(filePath) || win32.isAbsolute(filePath)) {
    throw new Error("只能使用项目工作区内的相对路径");
  }

  const target = resolve(root, filePath);
  if (!isInside(root, target)) {
    throw new Error("禁止访问项目工作区之外的文件");
  }

  return target;
}

async function resolveReadPath(root: string, filePath: string) {
  const target = resolveWorkspacePath(root, filePath);
  const realTarget = await realpath(target);
  if (!isInside(root, realTarget)) {
    throw new Error("禁止通过符号链接访问项目工作区之外的文件");
  }

  const info = await stat(realTarget);
  if (!info.isFile()) throw new Error("指定路径不是文件");
  return realTarget;
}

async function resolveWritePath(root: string, filePath: string) {
  const target = resolveWorkspacePath(root, filePath);
  const realParent = await realpath(dirname(target));
  if (!isInside(root, realParent)) {
    throw new Error("禁止通过符号链接修改项目工作区之外的文件");
  }

  return join(realParent, basename(target));
}

async function resolveRemovePath(root: string, filePath: string) {
  const target = resolveWorkspacePath(root, filePath);
  const realParent = await realpath(dirname(target));
  if (!isInside(root, realParent)) {
    throw new Error("禁止通过符号链接删除项目工作区之外的文件");
  }

  const removeTarget = join(realParent, basename(target));
  const info = await lstat(removeTarget);
  if (info.isSymbolicLink()) throw new Error("禁止删除符号链接");
  if (!info.isFile()) throw new Error("指定路径不是文件");
  return removeTarget;
}

function validateGlobPattern(pattern: string) {
  if (
    isAbsolute(pattern) ||
    win32.isAbsolute(pattern) ||
    pattern.split(/[\\/]/).includes("..")
  ) {
    throw new Error("搜索模式只能匹配当前项目工作区内的相对路径");
  }
}

async function* walkFiles(
  root: string,
  directory: string,
): AsyncGenerator<string> {
  const realDirectory = await realpath(directory);
  if (!isInside(root, realDirectory)) {
    throw new Error("禁止通过符号链接搜索项目工作区之外的目录");
  }

  const entries = (await readdir(realDirectory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  );

  for (const entry of entries) {
    const path = join(realDirectory, entry.name);
    if (entry.isFile()) {
      const realFile = await realpath(path);
      if (!isInside(root, realFile)) {
        throw new Error("禁止通过符号链接搜索项目工作区之外的文件");
      }
      yield realFile;
    }
    if (entry.isDirectory() && !IGNORED_DIRECTORIES.has(entry.name)) {
      yield* walkFiles(root, path);
    }
  }
}

async function* findFiles(root: string, pattern: string) {
  validateGlobPattern(pattern);
  const patterns = pattern.startsWith("**/")
    ? [pattern]
    : [pattern, `**/${pattern}`];

  for await (const file of walkFiles(root, root)) {
    const path = relative(root, file).split(sep).join("/");
    if (patterns.some((pattern) => matchesGlob(path, pattern))) yield path;
  }
}

export const readFileTool = tool(
  async ({ path }, runtime: FileToolRuntime) => {
    const root = await resolveWorkspaceRoot(runtime);
    const target = await resolveReadPath(root, path);
    if ((await stat(target)).size > MAX_FILE_BYTES) {
      throw new Error(`文件大小不能超过 ${MAX_FILE_BYTES} 字节`);
    }

    const content = await readFile(target, "utf8");
    if (content.length <= MAX_READ_CHARACTERS) return content;
    return (
      content.slice(0, MAX_READ_CHARACTERS - READ_TRUNCATION_NOTICE.length) +
      READ_TRUNCATION_NOTICE
    );
  },
  {
    name: "read_file",
    description: "读取当前项目工作区内的 UTF-8 文本文件，禁止访问工作区外的文件",
    schema: z.object({ path: pathSchema }),
  },
);

export const writeFileTool = tool(
  async ({ path, content }, runtime: FileToolRuntime) => {
    const root = await resolveWorkspaceRoot(runtime);
    const target = await resolveWritePath(root, path);
    const handle = await open(
      target,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_TRUNC |
        constants.O_NOFOLLOW,
      0o644,
    );

    try {
      await handle.writeFile(content, "utf8");
    } finally {
      await handle.close();
    }

    return `文件已写入：${relative(root, target)}`;
  },
  {
    name: "write_file",
    description:
      "在当前项目工作区内创建或覆盖 UTF-8 文本文件；父目录必须已存在，禁止修改工作区外的文件",
    schema: z.object({
      path: pathSchema,
      content: z.string().describe("要写入文件的完整内容"),
    }),
  },
);

export const removeFileTool = tool(
  async ({ path }, runtime: FileToolRuntime) => {
    const root = await resolveWorkspaceRoot(runtime);
    const target = await resolveRemovePath(root, path);
    await unlink(target);
    return `文件已删除：${relative(root, target)}`;
  },
  {
    name: "remove_file",
    description:
      "删除当前项目工作区内的普通文件；禁止删除目录、符号链接和工作区之外的文件",
    schema: z.object({ path: pathSchema }),
  },
);

export const globTool = tool(
  async ({ pattern }, runtime: FileToolRuntime) => {
    const root = await resolveWorkspaceRoot(runtime);
    const files: string[] = [];
    for await (const file of findFiles(root, pattern)) {
      files.push(file);
      if (files.length === MAX_GLOB_RESULTS) break;
    }

    if (files.length === 0) return "未找到匹配文件";
    const suffix = files.length === MAX_GLOB_RESULTS ? "\n...结果已截断" : "";
    return files.join("\n") + suffix;
  },
  {
    name: "glob",
    description:
      "使用 glob 模式搜索当前项目工作区任意深度的文件；不跟随符号链接，并跳过依赖和构建目录",
    schema: z.object({
      pattern: z.string().trim().min(1).describe("例如 skills/**/* 或 src/**/*.ts"),
    }),
  },
);

export const grepTool = tool(
  async ({ query, pattern, ignoreCase }, runtime: FileToolRuntime) => {
    const root = await resolveWorkspaceRoot(runtime);
    const matches: string[] = [];
    const expected = ignoreCase ? query.toLowerCase() : query;

    for await (const path of findFiles(root, pattern)) {
      const target = await resolveReadPath(root, path);
      if ((await stat(target)).size > MAX_FILE_BYTES) continue;

      const content = await readFile(target, "utf8");
      if (content.includes("\0")) continue;
      for (const [index, line] of content.split(/\r?\n/).entries()) {
        const value = ignoreCase ? line.toLowerCase() : line;
        if (!value.includes(expected)) continue;
        matches.push(`${path}:${index + 1}:${line.slice(0, 240)}`);
        if (matches.length === MAX_GREP_RESULTS) break;
      }
      if (matches.length === MAX_GREP_RESULTS) break;
    }

    if (matches.length === 0) return "未找到匹配内容";
    const suffix = matches.length === MAX_GREP_RESULTS ? "\n...结果已截断" : "";
    return matches.join("\n") + suffix;
  },
  {
    name: "grep",
    description:
      "在当前项目工作区内的文本文件中查找关键字，返回文件路径、行号和匹配行",
    schema: z.object({
      query: z.string().min(1).max(1_000).describe("要查找的文本关键字"),
      pattern: z
        .string()
        .trim()
        .min(1)
        .default("**/*")
        .describe("限定文件范围的 glob 模式"),
      ignoreCase: z.boolean().default(false).describe("是否忽略大小写"),
    }),
  },
);

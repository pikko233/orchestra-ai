import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  globTool,
  grepTool,
  readFileTool,
  removeFileTool,
  writeFileTool,
} from "./file-tools";

test("isolates file tools by user and project workspace", async () => {
  const originalWorkspaceRoot = process.env.AGENT_WORKSPACE_ROOT;
  const workspacesRoot = await mkdtemp(
    join(tmpdir(), "orchestra-workspaces-root-"),
  );
  const outside = await mkdtemp(join(tmpdir(), "orchestra-files-outside-"));
  const workspace = join(workspacesRoot, "user-a", "project-a");
  const context = {
    context: { userId: "user-a", projectId: "project-a", revision: 0 },
  };

  try {
    process.env.AGENT_WORKSPACE_ROOT = workspacesRoot;
    await mkdir(join(workspace, "nested"), { recursive: true });
    await mkdir(join(workspace, "src/lib/ai/skills"), { recursive: true });
    await writeFile(join(workspace, "inside.txt"), "hello", "utf8");
    await writeFile(join(workspace, "long.txt"), "a".repeat(100_001), "utf8");
    await writeFile(
      join(workspace, "oversized.txt"),
      "a".repeat(512_001),
      "utf8",
    );
    await writeFile(join(workspace, "remove-me.txt"), "temporary", "utf8");
    await writeFile(
      join(workspace, "src/lib/ai/skills/SKILL.md"),
      "skill content",
      "utf8",
    );
    await writeFile(join(outside, "secret.txt"), "secret", "utf8");
    await symlink(outside, join(workspace, "outside-link"));
    await symlink(
      join(outside, "secret.txt"),
      join(workspace, "outside-file-link"),
    );

    assert.equal(
      await readFileTool.invoke({ path: "inside.txt" }, context),
      "hello",
    );
    const truncated = await readFileTool.invoke({ path: "long.txt" }, context);
    assert.equal(truncated.length, 100_000);
    assert.match(truncated, /\.\.\.文件内容已截断$/);
    await assert.rejects(
      readFileTool.invoke({ path: "oversized.txt" }, context),
      /文件大小不能超过 512000 字节/,
    );
    await writeFileTool.invoke(
      {
        path: "nested/result.js",
        content: "const result = 'Needle';\nconsole.log(result);",
      },
      context,
    );
    assert.match(
      await readFile(join(workspace, "nested/result.js"), "utf8"),
      /Needle/,
    );
    assert.equal(
      await removeFileTool.invoke({ path: "remove-me.txt" }, context),
      "文件已删除：remove-me.txt",
    );
    await assert.rejects(readFile(join(workspace, "remove-me.txt"), "utf8"));
    assert.equal(
      await globTool.invoke({ pattern: "**/*.js" }, context),
      "nested/result.js",
    );
    assert.equal(
      await globTool.invoke({ pattern: "skills/**/*" }, context),
      "src/lib/ai/skills/SKILL.md",
    );
    assert.equal(
      await grepTool.invoke(
        {
          query: "needle",
          pattern: "**/*.js",
          ignoreCase: true,
        },
        context,
      ),
      "nested/result.js:1:const result = 'Needle';",
    );

    const outsidePath = relative(workspace, join(outside, "secret.txt"));
    await assert.rejects(
      readFileTool.invoke({ path: join(outside, "secret.txt") }, context),
    );
    await assert.rejects(readFileTool.invoke({ path: outsidePath }, context));
    await assert.rejects(
      writeFileTool.invoke({ path: outsidePath, content: "changed" }, context),
    );
    await assert.rejects(removeFileTool.invoke({ path: outsidePath }, context));
    await assert.rejects(removeFileTool.invoke({ path: "nested" }, context));
    await assert.rejects(
      readFileTool.invoke({ path: "outside-link/secret.txt" }, context),
    );
    await assert.rejects(
      writeFileTool.invoke(
        { path: "outside-link/new.txt", content: "bad" },
        context,
      ),
    );
    await assert.rejects(
      writeFileTool.invoke(
        { path: "outside-file-link", content: "bad" },
        context,
      ),
    );
    await assert.rejects(
      removeFileTool.invoke({ path: "outside-file-link" }, context),
    );
    await assert.rejects(globTool.invoke({ pattern: "../**/*" }, context));
    await assert.rejects(
      readFileTool.invoke(
        { path: "inside.txt" },
        {
          context: { userId: "user-a", projectId: "project-b", revision: 0 },
        },
      ),
    );
    await symlink(outside, join(workspacesRoot, "linked-user"));
    await assert.rejects(
      writeFileTool.invoke(
        { path: "escaped.txt", content: "bad" },
        {
          context: {
            userId: "linked-user",
            projectId: "project-a",
            revision: 0,
          },
        },
      ),
    );
    await assert.rejects(
      readFile(join(outside, "project-a/escaped.txt"), "utf8"),
    );
    await assert.rejects(
      readFileTool.invoke(
        { path: "inside.txt" },
        {
          context: { userId: "..", projectId: "project-a", revision: 0 },
        },
      ),
    );
    assert.equal(
      await grepTool.invoke(
        {
          query: "secret",
          pattern: "**/*",
          ignoreCase: false,
        },
        context,
      ),
      "未找到匹配内容",
    );
    assert.equal(await readFile(join(outside, "secret.txt"), "utf8"), "secret");
  } finally {
    if (originalWorkspaceRoot === undefined) {
      delete process.env.AGENT_WORKSPACE_ROOT;
    } else {
      process.env.AGENT_WORKSPACE_ROOT = originalWorkspaceRoot;
    }
    await Promise.all([
      rm(workspacesRoot, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]);
  }
});

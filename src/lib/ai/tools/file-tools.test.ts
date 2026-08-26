import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  globTool,
  grepTool,
  lsTool,
  readFileTool,
  removeFileTool,
  writeFileTool,
} from "./file-tools";

test("limits file tools to process.cwd()", async () => {
  const originalCwd = process.cwd();
  const workspace = await mkdtemp(join(tmpdir(), "orchestra-workspace-"));
  const outside = await mkdtemp(join(tmpdir(), "orchestra-files-outside-"));

  try {
    await mkdir(join(workspace, "nested"), { recursive: true });
    await mkdir(join(workspace, "src/lib/ai/skills"), { recursive: true });
    await writeFile(join(workspace, "inside.txt"), "hello", "utf8");
    await writeFile(join(workspace, ".env.local"), "API_KEY=secret", "utf8");
    await writeFile(join(workspace, "private.pem"), "private", "utf8");
    await writeFile(
      join(workspace, "service-account.json"),
      '{"private_key":"secret"}',
      "utf8",
    );
    await mkdir(join(workspace, ".git"));
    await writeFile(join(workspace, ".git/config"), "secret", "utf8");
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
    await writeFile(
      join(workspace, "src/lib/ai/remove-nested.ts"),
      "temporary",
      "utf8",
    );
    await writeFile(join(outside, "secret.txt"), "secret", "utf8");
    await symlink(outside, join(workspace, "outside-link"));
    await symlink(
      join(outside, "secret.txt"),
      join(workspace, "outside-file-link"),
    );
    await symlink(join(workspace, ".env.local"), join(workspace, "env-link"));
    await symlink(join(workspace, ".git"), join(workspace, "git-link"));
    process.chdir(workspace);

    assert.equal(await readFileTool.invoke({ path: "inside.txt" }), "hello");
    assert.equal(
      await readFileTool.invoke({ path: "lib/ai/skills/SKILL.md" }),
      "skill content",
    );
    const truncated = await readFileTool.invoke({ path: "long.txt" });
    assert.equal(truncated.length, 100_000);
    assert.match(truncated, /\.\.\.文件内容已截断$/);
    await assert.rejects(
      readFileTool.invoke({ path: "oversized.txt" }),
      /文件大小不能超过 512000 字节/,
    );

    await writeFileTool.invoke({
      path: "nested/result.js",
      content: "const result = 'Needle';\nconsole.log(result);",
    });
    await writeFileTool.invoke({
      path: "lib/ai/generated.ts",
      content: "export {};",
    });
    assert.match(
      await readFile(join(workspace, "nested/result.js"), "utf8"),
      /Needle/,
    );
    assert.equal(
      await readFile(join(workspace, "src/lib/ai/generated.ts"), "utf8"),
      "export {};",
    );
    assert.equal(
      await removeFileTool.invoke({ path: "remove-me.txt" }),
      "文件已删除：remove-me.txt",
    );
    await assert.rejects(readFile(join(workspace, "remove-me.txt"), "utf8"));
    assert.equal(
      await removeFileTool.invoke({ path: "lib/ai/remove-nested.ts" }),
      "文件已删除：src/lib/ai/remove-nested.ts",
    );

    assert.equal(
      await globTool.invoke({ pattern: "**/*.js" }),
      "nested/result.js",
    );
    assert.equal(
      await globTool.invoke({ pattern: "skills/**/*" }),
      "src/lib/ai/skills/SKILL.md",
    );
    assert.equal(
      await lsTool.invoke({ path: "src/lib/ai" }),
      "generated.ts\nskills/",
    );
    assert.equal(
      await lsTool.invoke({ path: "lib/ai" }),
      "generated.ts\nskills/",
    );
    await assert.rejects(lsTool.invoke({ path: "inside.txt" }));
    await assert.rejects(lsTool.invoke({ path: "outside-link" }));
    assert.equal(
      await grepTool.invoke({
        query: "needle",
        pattern: "**/*.js",
        ignoreCase: true,
      }),
      "nested/result.js:1:const result = 'Needle';",
    );

    for (const path of [
      ".env.local",
      ".git/config",
      "private.pem",
      "service-account.json",
      "env-link",
    ]) {
      await assert.rejects(readFileTool.invoke({ path }), /敏感文件或目录/);
    }
    await assert.rejects(
      writeFileTool.invoke({ path: ".env.test", content: "secret" }),
      /敏感文件或目录/,
    );
    await assert.rejects(
      writeFileTool.invoke({ path: "git-link/config", content: "changed" }),
      /敏感文件或目录/,
    );
    await assert.rejects(removeFileTool.invoke({ path: "private.pem" }), /敏感/);
    await assert.rejects(removeFileTool.invoke({ path: "git-link/config" }), /敏感/);
    await assert.rejects(lsTool.invoke({ path: "git-link" }), /敏感/);
    await assert.rejects(globTool.invoke({ pattern: ".env*" }));
    const rootEntries = await lsTool.invoke({ path: "." });
    assert.doesNotMatch(rootEntries, /\.env|\.git|private\.pem|service-account/);
    const allFiles = await globTool.invoke({ pattern: "**/*" });
    assert.doesNotMatch(allFiles, /\.env|\.git|private\.pem|service-account/);
    assert.equal(await readFile(join(workspace, ".git/config"), "utf8"), "secret");
    assert.equal(
      await grepTool.invoke({
        query: "secret",
        pattern: "**/*",
        ignoreCase: false,
      }),
      "未找到匹配内容",
    );

    const outsidePath = relative(workspace, join(outside, "secret.txt"));
    await assert.rejects(readFileTool.invoke({ path: join(outside, "secret.txt") }));
    await assert.rejects(readFileTool.invoke({ path: outsidePath }));
    await assert.rejects(
      writeFileTool.invoke({ path: outsidePath, content: "changed" }),
    );
    await assert.rejects(removeFileTool.invoke({ path: outsidePath }));
    await assert.rejects(removeFileTool.invoke({ path: "nested" }));
    await assert.rejects(
      readFileTool.invoke({ path: "outside-link/secret.txt" }),
    );
    await assert.rejects(
      writeFileTool.invoke({ path: "outside-link/new.txt", content: "bad" }),
    );
    await assert.rejects(
      writeFileTool.invoke({ path: "outside-file-link", content: "bad" }),
    );
    await assert.rejects(removeFileTool.invoke({ path: "outside-file-link" }));
    await assert.rejects(globTool.invoke({ pattern: "../**/*" }));
    assert.equal(
      await grepTool.invoke({
        query: "secret",
        pattern: "**/*",
        ignoreCase: false,
      }),
      "未找到匹配内容",
    );
    assert.equal(await readFile(join(outside, "secret.txt"), "utf8"), "secret");
  } finally {
    process.chdir(originalCwd);
    await Promise.all([
      rm(workspace, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]);
  }
});

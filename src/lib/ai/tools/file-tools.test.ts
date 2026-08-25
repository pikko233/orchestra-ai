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

test("reads and writes only inside process.cwd()", async () => {
  const originalCwd = process.cwd();
  const root = await mkdtemp(join(tmpdir(), "orchestra-files-root-"));
  const outside = await mkdtemp(join(tmpdir(), "orchestra-files-outside-"));

  try {
    process.chdir(root);
    await mkdir("nested");
    await mkdir("src/lib/ai/skills", { recursive: true });
    await writeFile("inside.txt", "hello", "utf8");
    await writeFile("remove-me.txt", "temporary", "utf8");
    await writeFile("src/lib/ai/skills/SKILL.md", "skill content", "utf8");
    await writeFile(join(outside, "secret.txt"), "secret", "utf8");
    await symlink(outside, "outside-link");
    await symlink(join(outside, "secret.txt"), "outside-file-link");

    assert.equal(await readFileTool.invoke({ path: "inside.txt" }), "hello");
    await writeFileTool.invoke({
      path: "nested/result.js",
      content: "const result = 'Needle';\nconsole.log(result);",
    });
    assert.match(await readFile("nested/result.js", "utf8"), /Needle/);
    assert.equal(
      await removeFileTool.invoke({ path: "remove-me.txt" }),
      "文件已删除：remove-me.txt",
    );
    await assert.rejects(readFile("remove-me.txt", "utf8"));
    assert.equal(await globTool.invoke({ pattern: "**/*.js" }), "nested/result.js");
    assert.equal(
      await globTool.invoke({ pattern: "skills/**/*" }),
      "src/lib/ai/skills/SKILL.md",
    );
    assert.equal(
      await grepTool.invoke({
        query: "needle",
        pattern: "**/*.js",
        ignoreCase: true,
      }),
      "nested/result.js:1:const result = 'Needle';",
    );

    const outsidePath = relative(root, join(outside, "secret.txt"));
    await assert.rejects(readFileTool.invoke({ path: join(outside, "secret.txt") }));
    await assert.rejects(readFileTool.invoke({ path: outsidePath }));
    await assert.rejects(
      writeFileTool.invoke({ path: outsidePath, content: "changed" }),
    );
    await assert.rejects(removeFileTool.invoke({ path: outsidePath }));
    await assert.rejects(removeFileTool.invoke({ path: "nested" }));
    await assert.rejects(readFileTool.invoke({ path: "outside-link/secret.txt" }));
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
      rm(root, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createCalendarEventTool,
  createSendEmailTool,
} from "./google-tools";

test("creates calendar events and sends email through Google APIs", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: input.toString(),
      body: JSON.parse(init?.body as string),
    });
    return Response.json(
      requests.length === 1
        ? { id: "event-1", status: "confirmed", htmlLink: "event-url" }
        : { id: "message-1", threadId: "thread-1" },
    );
  };

  try {
    await assert.rejects(
      createCalendarEventTool("token").invoke({
        title: "无时区事件",
        startTime: "2026-08-27T10:00:00",
        endTime: "2026-08-27T10:30:00",
        timeZone: "Asia/Shanghai",
      }),
    );
    await assert.rejects(
      createCalendarEventTool("token").invoke({
        title: "时间倒置事件",
        startTime: "2026-08-27T10:30:00+08:00",
        endTime: "2026-08-27T10:00:00+08:00",
        timeZone: "Asia/Shanghai",
      }),
      /结束时间必须晚于开始时间/,
    );
    await createCalendarEventTool("token").invoke({
      title: "测试事件",
      startTime: "2026-08-27T10:00:00+08:00",
      endTime: "2026-08-27T10:30:00+08:00",
      timeZone: "Asia/Shanghai",
    });
    await createSendEmailTool("token").invoke({
      to: ["test@example.com"],
      subject: "测试邮件",
      body: "发送成功",
    });
    await assert.rejects(
      createSendEmailTool("token", "fixed@example.com").invoke({
        to: ["other@example.com"],
        subject: "错误收件人",
        body: "不应发送",
      }),
      /收件人必须是已确认邮箱/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(
    requests[0].url,
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  assert.equal(requests[0].body.summary, "测试事件");
  assert.equal(
    requests[1].url,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  );
  assert.equal(typeof requests[1].body.raw, "string");
});

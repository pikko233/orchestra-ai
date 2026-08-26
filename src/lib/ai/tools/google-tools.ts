import { tool } from "langchain";
import { z } from "zod";

async function googleRequest(
  url: string,
  accessToken: string,
  body: unknown,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.error?.message ?? `Google API 请求失败 (${response.status})`,
    );
  }
  return result;
}

export function createCalendarEventTool(accessToken: string) {
  return tool(
    async ({ title, description, startTime, endTime, timeZone, attendees }) => {
      const event = await googleRequest(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        accessToken,
        {
          summary: title,
          description,
          start: { dateTime: startTime, timeZone },
          end: { dateTime: endTime, timeZone },
          attendees: attendees?.map((email) => ({ email })),
        },
      );

      return {
        id: event.id,
        status: event.status,
        url: event.htmlLink,
      };
    },
    {
      name: "create_calendar_event",
      description:
        "在用户明确要求后，在其 Google 主日历中创建事件。时间必须包含 RFC3339 时区偏移。",
      schema: z.object({
        title: z.string().trim().min(1).max(300),
        description: z.string().trim().max(5_000).optional(),
        startTime: z.string().trim().min(1).describe("RFC3339 开始时间"),
        endTime: z.string().trim().min(1).describe("RFC3339 结束时间"),
        timeZone: z.string().trim().min(1).describe("IANA 时区名称"),
        attendees: z.array(z.email()).max(20).optional(),
      }),
    },
  );
}

export function createSendEmailTool(accessToken: string) {
  return tool(
    async ({ to, cc, subject, body }) => {
      const message = [
        `To: ${to.join(", ")}`,
        cc?.length ? `Cc: ${cc.join(", ")}` : undefined,
        `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        body,
      ]
        .filter((line) => line !== undefined)
        .join("\r\n");
      const sent = await googleRequest(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        accessToken,
        { raw: Buffer.from(message).toString("base64url") },
      );

      return { id: sent.id, threadId: sent.threadId };
    },
    {
      name: "send_email",
      description: "仅在用户明确要求后，通过其 Gmail 发送纯文本邮件。",
      schema: z.object({
        to: z.array(z.email()).min(1).max(20),
        cc: z.array(z.email()).max(20).optional(),
        subject: z.string().trim().min(1).max(500),
        body: z.string().trim().min(1).max(50_000),
      }),
    },
  );
}

import { z } from "zod";

export const MAX_UPLOAD_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_CHAT_IMAGES = 3;
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const chatImageSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  source: z.enum(["upload", "generated"]),
  url: z.url({ protocol: /^https?$/ }),
});

export type ChatImage = z.infer<typeof chatImageSchema>;

export type PendingChatImage = {
  id: string;
  file: File;
  previewUrl: string;
};

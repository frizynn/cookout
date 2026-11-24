import { assetPath, attachmentPartName, messagePartName } from "../../attachments/index.ts";
import type { AttachmentCalls } from "../../messages/client.ts";
import type { ClientConnection } from "./request.ts";
import type { NewAttachment } from "../../attachments/index.ts";
import type { PostMessageRequest } from "../../messages/index.ts";
import { sendForBytes } from "./request.ts";

const NONE = 0;
const NAMES = { full: /filename\*=UTF-8''(?<name>[^;]+)/iu, plain: /filename="(?<name>[^"]*)"/iu } as const;

function named(which: keyof typeof NAMES, text: string): string {
  const found = NAMES[which].exec(text);
  if (found === null) {
    return "";
  }
  const { name = "" } = found.groups ?? {};
  return name;
}

function nameIn(disposition: string): string {
  return decodeURIComponent(named("full", disposition)) || named("plain", disposition);
}

export interface CreateMessageRequest extends PostMessageRequest {
  readonly attachments?: readonly NewAttachment[];
}

export function postBody(request: CreateMessageRequest): PostMessageRequest | FormData {
  const { attachments = [], ...post } = request;
  if (attachments.length === NONE) {
    return post;
  }
  const form = new FormData();
  form.append(messagePartName, JSON.stringify(post));
  for (const { bytes, name } of attachments) {
    form.append(attachmentPartName, new Blob([Uint8Array.from(bytes)]), name);
  }
  return form;
}

export function attachmentCalls(server: ClientConnection): AttachmentCalls {
  return {
    getAttachment: async (id) => {
      const { bytes, headers } = await sendForBytes({
        connection: server,
        method: "GET",
        params: { id },
        path: assetPath,
      });
      return {
        bytes,
        contentType: headers.get("content-type") ?? "",
        name: nameIn(headers.get("content-disposition") ?? ""),
      };
    },
  };
}

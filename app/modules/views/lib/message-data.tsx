import type { JsonValue, Message } from "../../sdk/index.ts";
import { DataBlock } from "../../design-system/index.tsx";
import type { ReactNode } from "react";

const TEXT = { data: "Data" } as const;

interface Shown {
  readonly label: string;
  readonly value: JsonValue;
}

interface MessageDataProps {
  readonly message: Message;
}

function isJsonObject(value: JsonValue): value is Readonly<Record<string, JsonValue>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shownData(text: string, data: JsonValue): Shown {
  if (isJsonObject(data) && typeof data["command"] === "string" && text === `/${data["command"]}`) {
    return { label: `Call to /${data["command"]}`, value: data["data"] ?? null };
  }
  return { label: TEXT.data, value: data };
}

export function MessageData(props: MessageDataProps): ReactNode {
  const { data = null, text } = props.message;
  if (data === null) {
    return null;
  }
  const shown = shownData(text, data);
  return <DataBlock label={shown.label} value={shown.value} />;
}

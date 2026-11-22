type Kind = "message" | "reply";

export const label = (kind: Kind): string => {
  switch (kind) {
    case "message":
      return "message";
  }
  return "unknown";
};

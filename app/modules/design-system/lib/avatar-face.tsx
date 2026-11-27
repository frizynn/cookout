import { hueOf, initialsOf } from "./avatar-look.ts";
import { CharacterImage } from "./character-image.tsx";
import type { ReactNode } from "react";
import { useAvatarImage } from "./use-avatar-image.ts";

const SIZES = {
  inline: { box: "h-4 w-4 text-[8px]", testId: "avatar" },
  large: { box: "h-14 w-14 text-lg", testId: "avatar" },
  row: { box: "h-6 w-6 text-[10px]", testId: "avatar" },
  small: { box: "h-8 w-8 text-xs", testId: "avatar" },
  tiny: { box: "h-5 w-5 text-[9px] ring-2 ring-background", testId: "replier-avatar" },
} as const;

interface AvatarFaceParts {
  readonly name: string;
  readonly agent: boolean;
  readonly size: keyof typeof SIZES;
}

function shapeOf(agent: boolean): string {
  if (agent) {
    return "rounded-[28%]";
  }
  return "rounded-full";
}

export function AvatarFace(parts: AvatarFaceParts): ReactNode {
  const { image, onError } = useAvatarImage(parts.name);
  const handleError = onError;
  const shape = shapeOf(parts.agent);
  const size = SIZES[parts.size];
  if (image === null && parts.agent) {
    return (
      <CharacterImage
        agent
        frame={`object-cover ${size.box} ${shape}`}
        look="bot"
        seed={parts.name}
        testId={size.testId}
      />
    );
  }
  if (image === null) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center font-semibold text-white select-none before:content-[attr(data-initials)] ${size.box} ${shape} ${hueOf(parts.name)}`}
        data-agent={parts.agent}
        data-initials={initialsOf(parts.name)}
        data-testid={size.testId}
      />
    );
  }
  return (
    <img
      alt={image.alt}
      className={`object-cover ${size.box} ${shape}`}
      data-agent={parts.agent}
      data-testid={size.testId}
      decoding="async"
      onError={handleError}
      src={image.src}
    />
  );
}

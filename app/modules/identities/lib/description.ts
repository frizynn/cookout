declare const brand: unique symbol;

export type Description = string & { readonly [brand]: "Description" };

export const descriptionLength = { maximum: 500, minimum: 1 } as const;

export function isDescription(value: string): value is Description {
  return (
    value === value.trim() && value.length >= descriptionLength.minimum && value.length <= descriptionLength.maximum
  );
}

export const identityPath = "/v1/identities/:name";

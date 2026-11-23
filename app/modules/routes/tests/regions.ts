import { screen, waitFor, within } from "@testing-library/react";

type Name = string | Readonly<RegExp> | ((accessibleName: string) => boolean);

interface RoleOptions {
  readonly name?: Name;
  readonly level?: number;
  readonly pressed?: boolean;
}

type Text = string | Readonly<RegExp>;

interface Region {
  readonly element: () => HTMLElement;
  readonly getByRole: (role: string, options?: RoleOptions) => HTMLElement;
  readonly getAllByRole: (role: string, options?: RoleOptions) => HTMLElement[];
  readonly queryByRole: (role: string, options?: RoleOptions) => HTMLElement | null;
  readonly queryAllByRole: (role: string, options?: RoleOptions) => HTMLElement[];
  readonly findByRole: (role: string, options?: RoleOptions) => Promise<HTMLElement>;
  readonly getByText: (text: Text) => HTMLElement;
  readonly findByText: (text: Text) => Promise<HTMLElement>;
}

function regionOf(element: () => HTMLElement): Region {
  return {
    element,
    findByRole: async (role, options) => {
      const found = await waitFor(() => within(element()).getByRole(role, options));
      return found;
    },
    findByText: async (text) => {
      const found = await waitFor(() => within(element()).getByText(text));
      return found;
    },
    getAllByRole: (role, options) => within(element()).getAllByRole(role, options),
    getByRole: (role, options) => within(element()).getByRole(role, options),
    getByText: (text) => within(element()).getByText(text),
    queryAllByRole: (role, options) => within(element()).queryAllByRole(role, options),
    queryByRole: (role, options) => within(element()).queryByRole(role, options),
  };
}

export function inSidebar(): Region {
  return regionOf(() => screen.getByRole("navigation", { name: "Sidebar" }));
}

export function inPane(): Region {
  return regionOf(() => screen.getByRole("main"));
}

export function inThread(): Region {
  return regionOf(() => screen.getByRole("complementary", { name: "Thread" }));
}

export function inProfile(): Region {
  return regionOf(() => screen.getByRole("complementary", { name: "Profile" }));
}

export function inTopBar(): Region {
  return regionOf(() => screen.getByRole("banner"));
}

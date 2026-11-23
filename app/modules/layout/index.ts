/**
 * The `layout` store: how the web UI is laid out for the person at this
 * browser, apart from what the board holds. An external store, read by
 * components with `useSyncExternalStore`. `theme` is the chosen theme,
 * `system`, `light` or `dark`: `chooseTheme` keeps it in the browser's
 * storage and sets it on the page's root element as `data-theme` (`system`
 * removes it, so the stylesheet follows the operating system's
 * `prefers-color-scheme`); the store reads it back when made, so a reload
 * keeps it. `settings` is whether the Settings panel is open, and `sidebar`
 * whether the sidebar is open on a narrow screen; `toggleSettings` and
 * `toggleSidebar` flip them, and `closeSidebar` closes the sidebar, as after
 * following a link in it.
 */

const themeChoices = ["system", "light", "dark"] as const;

interface LayoutState {
  readonly theme: ThemeChoice;
  readonly settings: boolean;
  readonly sidebar: boolean;
}

interface LayoutOptions {
  readonly storage: Pick<Storage, "getItem" | "removeItem" | "setItem">;
  readonly root: Pick<HTMLElement, "removeAttribute" | "setAttribute">;
}

const THEME_KEY = "cookout-theme";
const THEME_ATTRIBUTE = "data-theme";
const SYSTEM: ThemeChoice = "system";

function isThemeChoice(value: string | null): value is ThemeChoice {
  return themeChoices.some((choice) => choice === value);
}

function storedTheme(storage: LayoutOptions["storage"]): ThemeChoice {
  const stored = storage.getItem(THEME_KEY);
  if (isThemeChoice(stored)) {
    return stored;
  }
  return SYSTEM;
}

function keepTheme(options: LayoutOptions, theme: ThemeChoice): void {
  if (theme === SYSTEM) {
    options.storage.removeItem(THEME_KEY);
    options.root.removeAttribute(THEME_ATTRIBUTE);
    return;
  }
  options.storage.setItem(THEME_KEY, theme);
  options.root.setAttribute(THEME_ATTRIBUTE, theme);
}

/** The themes a person can choose: `system` follows the operating system's setting. */
export { themeChoices };

/** One of the theme choices. */
export type ThemeChoice = (typeof themeChoices)[number];

/** The layout store. `subscribe` and `snapshot` are the two halves `useSyncExternalStore` takes. */
export interface Layout {
  /** Calls `listener` after every change, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The current snapshot: a new object whenever it changes, the same one until then. */
  readonly snapshot: () => LayoutState;
  /** Applies the theme at once and keeps it in the browser's storage. */
  readonly chooseTheme: (theme: ThemeChoice) => void;
  /** Opens the Settings panel, or closes it if it is open. */
  readonly toggleSettings: () => void;
  /** Opens the sidebar on a narrow screen, or closes it if it is open. */
  readonly toggleSidebar: () => void;
  /** Closes the sidebar on a narrow screen. */
  readonly closeSidebar: () => void;
}

/**
 * Makes a layout store that keeps the theme in `options.storage` and sets it on `options.root`.
 * @param options The storage and the root element.
 * @returns The store.
 */
export function createLayout(options: LayoutOptions): Layout {
  const listeners = new Set<() => void>();
  let current: LayoutState = { settings: false, sidebar: false, theme: storedTheme(options.storage) };
  keepTheme(options, current.theme);

  function publish(next: Partial<LayoutState>): void {
    current = { ...current, ...next };
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    chooseTheme: (theme) => {
      keepTheme(options, theme);
      publish({ theme });
    },
    closeSidebar: () => {
      if (current.sidebar) {
        publish({ sidebar: false });
      }
    },
    snapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    toggleSettings: () => {
      publish({ settings: !current.settings });
    },
    toggleSidebar: () => {
      publish({ sidebar: !current.sidebar });
    },
  };
}

# Web components

The shape a React component takes to pass the UI lint rules on its first commit. Writing it this way from the start is cheap; #97 rewrote about 25 files to fit it after the fact.

## One component, shown

`SidebarSettings` in [sidebar-settings.tsx](../app/modules/views/lib/sidebar-settings.tsx), trimmed:

```tsx
interface SidebarSettingsProps {
  readonly identity: Identity;
  readonly layout: Layout;
  readonly open: boolean;
}

export function SidebarSettings(props: SidebarSettingsProps): ReactNode {
  const { identity, layout } = props;
  const state = useSyncExternalStore(layout.subscribe, layout.snapshot);
  const handleToggle = layout.toggleSettings;
  const handleChoose = useCallback(
    (value: string) => {
      for (const theme of themesOf(value)) {
        layout.chooseTheme(theme);
      }
    },
    [layout],
  );
  return (
    <>
      {state.settings && (
        <Panel label={TEXT.settings}>
          <ChoiceGroup choices={THEMES} label={TEXT.theme} onChoose={handleChoose} value={state.theme} />
        </Panel>
      )}
      <ToggleButton expanded={state.settings} onClick={handleToggle}>
        {TEXT.settings}
      </ToggleButton>
    </>
  );
}
```

What each rule asks, and how this meets it:

- `no-multi-comp`: one component per file. A second component, even a small row, gets its own file in the module's lib folder.
- `jsx-max-depth`: keep the returned tree shallow. When nesting grows, the inner part becomes its own component (and so its own file); design-system parts such as `Panel` and `ToggleButton` carry the markup.
- `jsx-no-jsx-as-prop`: pass JSX as `children`, never as another prop.
- `no-ternary`: show or hide with `&&`; pick between values in a small function with `if` and early returns.
- `jsx-handler-names`: a function passed to an `on…` prop is named `handle…` (`handleToggle`, `handleChoose`); one made in the component is wrapped in `useCallback`.
- `prefer-readonly-parameter-types`: every props field is `readonly`, and arrays are `readonly T[]`.
- `max-dependencies`: a file imports only what it draws with; split the component before its import list grows long.

## State comes from a store

A view holds no state that outlives it. State lives in a store, a plain `.ts` module with no React, such as `createLayout` in [layout/index.ts](../app/modules/layout/index.ts): it exposes `subscribe` and `snapshot`, and methods that change the state and notify subscribers. [web.tsx](../app/web.tsx) makes each store once and passes it down through `CookoutApp`'s props; a view reads it with `useSyncExternalStore(store.subscribe, store.snapshot)` and calls its methods from handlers. Tests in `app/modules/routes/tests/` draw `CookoutApp` on real stores against a real server and check what a person sees.

## Check it

Commit after each component: the pre-commit hook prints what is left to fix while the component is small. Then `pnpm screenshots` takes the standard screens in both themes ([verification.md](verification.md#see-the-web-ui-in-both-themes)).

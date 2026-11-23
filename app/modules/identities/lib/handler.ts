interface Handled {
  readonly name: string;
  readonly handler?: true;
}

const NO_COMMANDS: readonly string[] = [];

export function handledCommands(identity: Handled): readonly string[] {
  if (identity.handler === true) {
    return [identity.name];
  }
  return NO_COMMANDS;
}

export function deactivationWarning(identity: Handled): string {
  return handledCommands(identity)
    .map((command) => `/${command} will stop replying until @${identity.name} is reactivated.`)
    .join(" ");
}

export function deletionWarning(identity: Handled): string {
  return handledCommands(identity)
    .map((command) => `/${command} is removed with it and stops replying.`)
    .join(" ");
}

function note(): void {
  console.info("note");
}

function other(): void {
  console.info("other");
}

export const choose = (flag: boolean): void => (flag ? note() : other());

const theme = globalThis.localStorage.getItem("cookout-theme");

if (theme === "light" || theme === "dark") {
  globalThis.document.documentElement.dataset.theme = theme;
}

const isAlreadyOnDom = (selector: string): boolean => document.querySelector(selector) !== null;

export const appLoadStyles = (styles: { href: string }[]): void => {
  for (const style of styles) {
    if (isAlreadyOnDom(`link[href="${style.href}"][rel="stylesheet"]`)) {
      continue;
    }
    const node = document.createElement("link");

    node.href = style.href;
    node.rel = "stylesheet";

    document.head.appendChild(node);
  }
};

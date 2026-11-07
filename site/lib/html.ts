/** A tiny HTML template tag. Values are escaped unless they're already markup. */
export class Markup {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

type Value = Markup | string | number | boolean | null | undefined | Value[];

function render(value: Value): string {
  if (value === null || value === undefined || value === false || value === true) return "";
  if (value instanceof Markup) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return escape(String(value));
}

export function html(strings: TemplateStringsArray, ...values: Value[]): Markup {
  let output = "";
  strings.forEach((text, i) => {
    output += text.replace(/\n\s*/g, "") + (i < values.length ? render(values[i]) : "");
  });
  return new Markup(output);
}

export function raw(text: string): Markup {
  return new Markup(text);
}

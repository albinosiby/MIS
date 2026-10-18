/** Static control inventory complements browser scenarios; it does not prove runtime behavior. */
import ts from "typescript";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : entry.name.endsWith(".tsx")
        ? [join(dir, entry.name)]
        : [],
  );
}
const inventory: {
  file: string;
  line: number;
  tag: string;
  binding: string;
}[] = [];
for (const file of [
  ...files("src/features"),
  ...files("src/components/layout"),
]) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (["Button", "button", "Link", "LinkButton"].includes(tag)) {
        const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
        const names = attrs.map((a) => a.name.getText(source));
        const binding = attrs.some(
          (a) => a.name.getText(source) === "disabled" && !a.initializer,
        )
          ? "disabled sample"
          : names.includes("href")
            ? "navigation"
            : names.includes("onClick")
              ? "click handler"
              : names.includes("asChild")
                ? "child link"
                : attrs.some(
                      (a) =>
                        a.name.getText(source) === "type" &&
                        a.initializer?.getText(source) === '"submit"',
                    )
                  ? "form submit"
                  : names.includes("form")
                    ? "named form"
                    : "review";
        inventory.push({
          file,
          line: source.getLineAndCharacterOfPosition(node.pos).line + 1,
          tag,
          binding,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
writeFileSync(
  "/tmp/mis-control-inventory.json",
  JSON.stringify(inventory, null, 2),
);
console.log(
  JSON.stringify(
    {
      controls: inventory.length,
      bindings: Object.fromEntries(
        [
          "navigation",
          "click handler",
          "child link",
          "form submit",
          "named form",
          "disabled sample",
          "review",
        ].map((k) => [k, inventory.filter((c) => c.binding === k).length]),
      ),
      review: inventory.filter((c) => c.binding === "review"),
    },
    null,
    2,
  ),
);
if (inventory.some((control) => control.binding === "review")) process.exitCode = 1;

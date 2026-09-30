import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postcss from "postcss";
import ts from "typescript";

const directory = fileURLToPath(new URL("../src/styles/", import.meta.url));
const materialTokens = new Set(["--glass-brightness", "--glass-contrast", "--glass-blur", "--glass-fade-distance", "--glass-sample-count"]);
const controlTokens = new Set(["--glass-control-blur", "--glass-control-tone-strength", "--glass-control-light-brightness", "--glass-control-dark-brightness", "--glass-control-contrast", "--glass-control-brightness"]);
const controlRenderer = ':is(#root, html) [data-glass-material="control"] > .glass-renderer';
const controlRecipe = new Map([
  ["--glass-blur", "var(--glass-control-blur)"],
  ["--glass-brightness", "var(--glass-control-brightness)"],
  ["--glass-contrast", "var(--glass-control-contrast)"]
]);
const tutorialRenderer = ':is(#root, html) [data-glass-material="tutorial-focus"] > .glass-renderer';
const tutorialRecipe = new Map([
  ["--glass-blur", "var(--glass-tutorial-focus-blur)"],
  ["--glass-brightness", "1"],
  ["--glass-contrast", "1"]
]);
let tutorialBlurCount = 0;
const blurRenderer = ":is(#root, html) .glass-blur-layer";
const toneRenderer = ":is(#root, html) .glass-renderer::after";
const roundedRenderer = `${blurRenderer}, ${toneRenderer}`;
const solidRenderer = 'html[data-glass-fade-mode="solid"] :is(#root, body) .glass-blur-layer, html[data-glass-fade-mode="solid"] :is(#root, body) .glass-renderer::after';
const fadeRenderer = ".split-pane .city-split-resizer::before";
const filters = new Map([
  [blurRenderer, "blur(var(--glass-sample-blur))"],
  [toneRenderer, "contrast(var(--glass-contrast)) brightness(var(--glass-brightness))"]
]);
const tokenCounts = new Map([...materialTokens].map((token) => [token, 0]));
const controlTokenCounts = new Map([...controlTokens].map((token) => [token, 0]));
let blurCount = 0;
let maskCount = 0;
let sampleCount = 0;
const errors = [];
for (const name of await fs.readdir(directory)) {
  if (!name.endsWith(".css")) continue;
  const css = postcss.parse(await fs.readFile(path.join(directory, name), "utf8"), { from: name });
  css.walkDecls((declaration) => {
    const { prop, value } = declaration;
    const selector = declaration.parent.selector;
    const fail = (reason) => errors.push(`${name}:${declaration.source.start.line}: ${reason}`);
    if (prop === "--glass-sample-count") sampleCount = Number(value);
    if (materialTokens.has(prop)) {
      const themeTone = ["--glass-brightness", "--glass-contrast"].includes(prop) && selector === "html.theme-dark-root, .split-pane.theme-dark";
      const controlMaterial = selector === controlRenderer && controlRecipe.get(prop) === value;
      const tutorialMaterial = selector === tutorialRenderer && tutorialRecipe.get(prop) === value;
      if (name !== "glass.css" || (selector !== ":root" && !themeTone && !controlMaterial && !tutorialMaterial)) fail(`${prop} must use a canonical material in glass.css`);
      tokenCounts.set(prop, tokenCounts.get(prop) + 1);
    }
    if (controlTokens.has(prop)) {
      const themeTone = prop === "--glass-control-brightness" && selector === "html.theme-dark-root, .split-pane.theme-dark";
      if (name !== "glass.css" || (selector !== ":root" && !themeTone)) fail("Control recipes must be defined centrally in glass.css");
      controlTokenCounts.set(prop, controlTokenCounts.get(prop) + 1);
    }
    if (prop === "--glass-tutorial-focus-blur") {
      if (name !== "glass.css" || selector !== ":root" || value !== "3px") fail("Tutorial focus must use the central 3px blur recipe");
      tutorialBlurCount++;
    }
    if (["--glass-color", "--glass-opacity"].includes(prop)) fail("Glass must tone the backdrop, never add a color fill");
    if (name === "glass.css" && prop.startsWith("background") && value !== "transparent") fail("The glass renderer must have a transparent background");
    if (prop.endsWith("backdrop-filter") && value !== "none") {
      if (name !== "glass.css" || filters.get(selector) !== value) fail("blur and tone must use the shared glass renderer");
      blurCount++;
    }
    if (prop.endsWith("mask-image")) {
      const solidGeometry = selector === solidRenderer && value === "none";
      if (name !== "glass.css" || (!solidGeometry && ![fadeRenderer, roundedRenderer].includes(selector))) fail("fade must use the shared glass renderer");
      maskCount++;
    }
  });
}
// A tagged React surface must render the same decoration as vendor controls.
async function checkSurfaces(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { await checkSurfaces(filename); continue; }
    if (!entry.name.endsWith(".tsx")) continue;
    const source = ts.createSourceFile(filename, await fs.readFile(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (ts.isJsxElement(node)) {
        const tagged = node.openingElement.attributes.properties.some((attribute) => ts.isJsxSpreadAttribute(attribute)
          && ts.isCallExpression(attribute.expression) && attribute.expression.expression.getText(source) === "glassSurface");
        const rendered = node.children.some((child) => ts.isJsxSelfClosingElement(child) && child.tagName.getText(source) === "GlassMaterial");
        if (tagged && !rendered) errors.push(`${filename}: glassSurface requires the shared GlassMaterial decoration`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}
await checkSurfaces(path.join(directory, ".."));
const recipePath = path.join(directory, "glassFade.ts");
const recipe = ts.createSourceFile(recipePath, await fs.readFile(recipePath, "utf8"), ts.ScriptTarget.Latest, true);
let samples = [];
const readSamples = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(recipe) === "GLASS_SAMPLES") {
    const value = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
    if (ts.isArrayLiteralExpression(value)) samples = value.elements.map((element) => Number(element.getText(recipe)));
  }
  ts.forEachChild(node, readSamples);
};
readSamples(recipe);
if (samples.length !== sampleCount || samples.some((sample, index) => sample !== index + 1)) errors.push("CSS and DOM blur samples must share one ordered profile");
for (const [token, count] of tokenCounts) {
  const expected = (["--glass-brightness", "--glass-contrast"].includes(token) ? 2 : 1) + (controlRecipe.has(token) ? 1 : 0) + (tutorialRecipe.has(token) ? 1 : 0);
  if (count !== expected) errors.push(`${token} has competing or missing material definitions`);
}
for (const [token, count] of controlTokenCounts) {
  if (count !== (token === "--glass-control-brightness" ? 2 : 1)) errors.push(`${token} has competing or missing control definitions`);
}
if (blurCount !== 4 || maskCount !== 3) errors.push("Expected one progressive blur renderer and one backdrop tone renderer, with shared faded and solid geometry");
if (tutorialBlurCount !== 1) errors.push("Expected one tutorial focus blur definition");
if (errors.length) throw new Error(errors.join("\n"));
console.log("Glass pipeline check passed: surface, control and tutorial recipes share one transparent blur and tone renderer.");

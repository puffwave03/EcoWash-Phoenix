import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("src/components/order-photos/OrderPhotosPanel.tsx");
const validation = read("src/features/order-photos/validation.ts");
const actions = read("src/features/order-photos/server/actions.ts");
const config = read("next.config.ts");
const limit = 1024 * 1024;

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function clientHandlers(onError) {
  const helper = panel.slice(panel.indexOf("function photoExceedsLimit"), panel.indexOf("export function OrderPhotosPanel"));
  const handlers = panel.slice(panel.indexOf("  function handlePhotoChange"), panel.indexOf("\n\n  return (", panel.indexOf("  function handlePhotoChange")));
  assert.ok(helper.startsWith("function photoExceedsLimit"));
  assert.ok(handlers.startsWith("  function handlePhotoChange"));
  return runInNewContext(`${transpile(`${helper}\n${handlers}`)}\n({ photoExceedsLimit, handlePhotoChange, handleSubmit })`, {
    MAX_ORDER_PHOTO_BYTES: limit,
    setClientPhotoTooLarge: onError,
  });
}

function submission(handlers, size) {
  let prevented = false;
  handlers.handleSubmit({
    currentTarget: { elements: { namedItem: () => ({ files: [{ size }] }) } },
    preventDefault: () => { prevented = true; },
  });
  return prevented;
}

test("client selection uses canonical limit and immediately maps oversize to localized size error", () => {
  assert.match(validation, /export const MAX_ORDER_PHOTO_BYTES = 1024 \* 1024/);
  assert.match(panel, /import \{ MAX_ORDER_PHOTO_BYTES \} from "@\/features\/order-photos\/validation"/);
  assert.match(panel, /file\.size > MAX_ORDER_PHOTO_BYTES/);
  assert.match(panel, /clientPhotoTooLarge\s*\? text\.photoErrors\.size/);
  assert.match(panel, /onChange=\{handlePhotoChange\}/);
  let error = false;
  const handlers = clientHandlers((value) => { error = value; });
  handlers.handlePhotoChange({ currentTarget: { files: [{ size: limit + 1 }] } });
  assert.equal(error, true);
  handlers.handlePhotoChange({ currentTarget: { files: [{ size: limit }] } });
  assert.equal(error, false);
});

test("normal UI submission blocks oversize but permits exactly 1 MB and smaller files", () => {
  let error = false;
  const handlers = clientHandlers((value) => { error = value; });
  assert.match(panel, /onSubmit=\{handleSubmit\}/);
  assert.equal(submission(handlers, limit + 1), true);
  assert.equal(error, true);
  error = false;
  assert.equal(submission(handlers, limit), false);
  assert.equal(error, false);
  assert.equal(submission(handlers, limit - 1), false);
});

test("Next.js transport has only 2 MB headroom and server retains the 1 MB business rule", () => {
  assert.match(config, /experimental:\s*\{\s*serverActions:\s*\{\s*bodySizeLimit: "2mb"/);
  assert.match(validation, /file\.size > MAX_ORDER_PHOTO_BYTES\) fieldErrors\.photo = "size"/);
  assert.match(actions, /parsePhotoForm\(formData\)[\s\S]*if \(!valid \|\| !input\.file\) return fail\(fieldErrors, null\)/);
  assert.match(actions, /hasAllowedImageSignature\(input\.file\)/);
  assert.match(panel, /case "required": return text\.photoErrors\.required/);
  assert.match(panel, /case "mime": return text\.photoErrors\.mime/);
  assert.match(panel, /case "signature": return text\.photoErrors\.signature/);
  assert.match(panel, /id="order-photo-error" role="alert"/);
  assert.match(panel, /aria-describedby=\{photoError/);
});

test("all five locale files remain valid and retain size and other photo messages", () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const photos = JSON.parse(read(`src/i18n/${locale}/common.json`)).orders.photos;
    for (const code of ["required", "size", "mime", "signature"]) {
      assert.ok(photos.photoErrors[code], `${locale}: ${code}`);
    }
  }
});

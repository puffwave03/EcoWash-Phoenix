import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const validation = read("src/features/order-photos/validation.ts");
const actions = read("src/features/order-photos/server/actions.ts");
const panel = read("src/components/order-photos/OrderPhotosPanel.tsx");
const page = read("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx");

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const validationExports = {};
runInNewContext(transpile(validation), {
  exports: validationExports,
  require: () => ({ PHOTO_CATEGORIES: ["intake"] }),
  File,
  Uint8Array,
});

function parseFile(file) {
  const form = new FormData();
  form.set("category", "intake");
  if (file) form.set("photo", file);
  return validationExports.parsePhotoForm(form);
}

test("server size validation rejects above 1 MB and accepts exactly 1 MB", () => {
  const limit = validationExports.MAX_ORDER_PHOTO_BYTES;
  assert.equal(limit, 1024 * 1024);
  assert.equal(parseFile(new File([new Uint8Array(limit + 1)], "large.png", { type: "image/png" })).fieldErrors.photo, "size");
  const exact = parseFile(new File([new Uint8Array(limit)], "exact.png", { type: "image/png" }));
  assert.equal(exact.valid, true);
  assert.equal(exact.fieldErrors.photo, undefined);
});

test("server remains authoritative for required, MIME, and signature failures", async () => {
  assert.equal(parseFile(null).fieldErrors.photo, "required");
  assert.equal(parseFile(new File(["x"], "wrong.txt", { type: "text/plain" })).fieldErrors.photo, "mime");
  assert.equal(await validationExports.hasAllowedImageSignature(new File(["not png"], "fake.png", { type: "image/png" })), false);
  assert.match(actions, /parsePhotoForm\(formData\)[\s\S]*if \(!valid \|\| !input\.file\) return fail\(fieldErrors, null\)/);
  assert.match(actions, /hasAllowedImageSignature\(input\.file\)[\s\S]*return fail\(\{ photo: "signature" \}, null\)/);
});

test("all known photo errors map inline and unknown errors fall back safely", () => {
  const mapping = panel.slice(panel.indexOf("function photoErrorMessage"), panel.indexOf("export function OrderPhotosPanel"));
  const message = runInNewContext(`${transpile(`type OrderPhotosPanelText = any;\n${mapping}`)}\nphotoErrorMessage`);
  const text = { error: "generic", photoErrors: { required: "required message", size: "size message", mime: "mime message", signature: "signature message" } };
  for (const code of ["required", "size", "mime", "signature"]) {
    assert.equal(message(code, text), `${code} message`);
    assert.match(page, new RegExp(`photos\\.photoErrors\\.${code}`));
  }
  assert.equal(message("unexpected", text), "generic");
  assert.equal(message(undefined, text), null);
  assert.match(panel, /aria-describedby=\{photoError \? "order-photo-help order-photo-error" : "order-photo-help"\}/);
  assert.match(panel, /aria-invalid=\{Boolean\(photoError\)\}/);
  assert.match(panel, /id="order-photo-error" role="alert"/);
  assert.match(panel, /id="order-photo-help">\{text\.fileHelp\}/);
  assert.match(panel, /className=\{fieldClass\(Boolean\(photoError\)\)\}/);
});

test("all five locales provide distinct photo-field messages", () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const photos = JSON.parse(read(`src/i18n/${locale}/common.json`)).orders.photos;
    for (const code of ["required", "size", "mime", "signature"]) {
      assert.ok(photos.photoErrors[code], `${locale}: ${code}`);
      assert.notEqual(photos.photoErrors[code], photos.error);
    }
    assert.match(photos.photoErrors.size, /1 (?:MB|Mo)/);
    assert.ok(photos.fileHelp);
  }
});

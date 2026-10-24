import assert from "node:assert/strict";
import test from "node:test";
import { imageSchema, socialLinkSchema, videoSchema, variantSchema } from "../src/validators/schemas";

test("product images accept owner storage paths without accepting traversal", () => {
  const image = { image_url: "/uploads/products/bottle.jpg", is_primary: false, sort_order: 0 };
  assert.equal(imageSchema.safeParse(image).success, true);
  assert.equal(imageSchema.safeParse({ ...image, image_url: "/uploads/../.env" }).success, false);
  assert.equal(imageSchema.safeParse({ ...image, image_url: "/uploads/%2e%2e/.env" }).success, false);
});

test("YouTube video URLs reject unrelated hosts", () => {
  const video = {
    title: "Owner supplied video",
    video_url: "https://www.youtube.com/watch?v=official-id",
    platform: "YOUTUBE",
  };
  assert.equal(videoSchema.safeParse(video).success, true);
  assert.equal(videoSchema.safeParse({ ...video, video_url: "https://youtube.com.attacker.example/watch?v=x" }).success, false);
});

test("social links reject executable URL schemes", () => {
  const link = { platform: "FACEBOOK", name: "Facebook", url: "https://facebook.com/official" };
  assert.equal(socialLinkSchema.safeParse(link).success, true);
  assert.equal(socialLinkSchema.safeParse({ ...link, url: "javascript:alert(1)" }).success, false);
});

test("variant validation rejects negative price and invented invalid volume", () => {
  const variant = { sku: "OWNER-SKU", name: "Owner provided variant", price: 10 };
  assert.equal(variantSchema.safeParse(variant).success, true);
  assert.equal(variantSchema.safeParse({ ...variant, price: -1 }).success, false);
  assert.equal(variantSchema.safeParse({ ...variant, volume: 0 }).success, false);
});

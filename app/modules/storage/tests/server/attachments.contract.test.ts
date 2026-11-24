import { Array as Arr, Effect, FileSystem, Layer, Option, Predicate, Stream } from "effect";
import { AssetStore, diskAssetStore, memoryAssetStore } from "../../../storage/server.ts";
import type { Attachment, AttachmentId } from "../../../attachments/index.ts";
import {
  appendTo,
  channelFixture as channel,
  freshDatabasePath,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { isAttachmentId } from "../../../attachments/index.ts";
import { layer as nodeServices } from "@effect/platform-node/NodeServices";

const PHOTO_SIZE = 3;
const NOTES_SIZE = 5;
const BYTE = 9;

function attachmentId(raw: string): AttachmentId {
  return Option.getOrThrow(Option.liftPredicate(raw, isAttachmentId));
}

const MISSING = attachmentId("missing");
const freshDiskAssets = Layer.unwrap(Effect.map(freshDatabasePath, (path) => diskAssetStore(`${path}-assets`)));

const photo: Attachment = {
  contentType: "image/png",
  id: attachmentId("photo-id"),
  image: true,
  name: "photo.png",
  size: PHOTO_SIZE,
};

const notes: Attachment = {
  contentType: "application/octet-stream",
  id: attachmentId("notes-id"),
  image: false,
  name: "../notes.txt",
  size: NOTES_SIZE,
};

const kept: Attachment = { ...notes, id: attachmentId("kept-id"), name: "kept.txt" };

it.effect.each(storageLayers)(
  "storage contract ($adapter): a message keeps its attachments in order wherever it is read, and each is found by ID",
  ({ layer }) =>
    Effect.gen(function* attachmentsKept() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const message = yield* appendTo(storage)({ ...newMessage("grill", ""), attachments: [photo, notes] });
      const plain = yield* appendTo(storage)(newMessage("grill", "no files"));
      const thread = yield* storage.getThread(message.id);
      const found = yield* Effect.forEach([photo.id, notes.id, MISSING], storage.findAttachment, { concurrency: 1 });

      expect(message).toMatchObject({ attachments: [photo, notes], text: "" });
      expect([thread, Arr.filter(found, Predicate.isNotUndefined)]).toStrictEqual([
        { parent: message, replies: [] },
        [photo, notes],
      ]);
      expect([Arr.map(found, Predicate.isUndefined), Predicate.hasProperty(plain, "attachments")]).toStrictEqual([
        [false, false, true],
        false,
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): deleting a channel deletes its messages' attachment records and answers their IDs",
  ({ layer }) =>
    Effect.gen(function* attachmentsDeleted() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      yield* storage.createChannel(channel("lounge"));
      const parent = yield* appendTo(storage)({ ...newMessage("grill", "files"), attachments: [photo] });
      yield* appendTo(storage)({ ...newMessage("grill", "reply", { replyTo: parent.id }), attachments: [notes] });
      yield* appendTo(storage)({ ...newMessage("lounge", "kept"), attachments: [kept] });
      const deleted = yield* storage.deleteChannel(channel("grill").name);
      const found = yield* Effect.forEach([photo.id, notes.id, kept.id], storage.findAttachment, { concurrency: 1 });

      expect(deleted).toStrictEqual({ attachments: [photo.id, notes.id], channel: channel("grill") });
      expect(Arr.map(found, (one) => one ?? "gone")).toStrictEqual(["gone", "gone", kept]);
    }),
);

const assetStores = [
  { adapter: "memory", layer: memoryAssetStore },
  { adapter: "disk", layer: freshDiskAssets.pipe(Layer.provide(nodeServices)) },
] as const;

it.effect.each(assetStores)("asset store ($adapter): bytes are put, read back whole and removed by ID", ({ layer }) =>
  Effect.gen(function* assetsRoundTrip() {
    const assets = yield* AssetStore;
    const bytes = new Uint8Array(NOTES_SIZE).fill(BYTE);
    yield* assets.put(notes.id, bytes);
    const read = yield* Stream.runCollect(assets.read(notes.id));
    yield* assets.remove([notes.id]);
    const gone = yield* Effect.flip(Stream.runCollect(assets.read(notes.id)));

    expect(Uint8Array.from(Arr.flatMap(read, (chunk) => [...chunk]))).toStrictEqual(bytes);
    expect(gone).toMatchObject({ _tag: "StorageUnavailable" });
  }).pipe(Effect.provide(layer)),
);

it.effect("asset store (disk): each file is named by its attachment ID alone, never by its posted name", () =>
  Effect.gen(function* namedById() {
    const fs = yield* FileSystem.FileSystem;
    const folder = `${yield* freshDatabasePath}-assets`;
    const assets = yield* Effect.provide(Effect.service(AssetStore), diskAssetStore(folder));
    yield* assets.put(notes.id, new Uint8Array(NOTES_SIZE).fill(BYTE));
    const files = yield* fs.readDirectory(folder);

    expect(files).toStrictEqual([notes.id]);
  }).pipe(Effect.scoped, Effect.provide(nodeServices)),
);

it.effect("asset store (disk): a put that can't be written fails as unavailable and leaves no partial file", () =>
  Effect.gen(function* putFails() {
    const fs = yield* FileSystem.FileSystem;
    const folder = `${yield* freshDatabasePath}-assets`;
    const assets = yield* Effect.provide(Effect.service(AssetStore), diskAssetStore(folder));
    yield* fs.remove(folder, { recursive: true });
    const failed = yield* Effect.flip(assets.put(notes.id, new Uint8Array(NOTES_SIZE).fill(BYTE)));
    const left = yield* fs.exists(folder);

    expect([failed, left]).toMatchObject([{ _tag: "StorageUnavailable" }, false]);
  }).pipe(Effect.scoped, Effect.provide(nodeServices)),
);

import { PgTypes } from "@effect/sql-pg";
import { Result } from "effect";

type Bytes = Readonly<Uint8Array>;

type Read<Value> = (bytes: Bytes) => Result.Result<Value, PgTypes.CodecError>;

const INT8_BYTES = 8;
const FIRST_BYTE = 0;
const FALSE_BYTE = 0;
const FALSE_BIT = 0;
const TRUE_BIT = 1;
const START = 0;

function readAs<Value>(oid: number, decode: Read<Value>): PgTypes.Codec<Value> {
  return { decode, encode: (value) => PgTypes.encode(value, oid) };
}

function readInt8(bytes: Bytes): Result.Result<number, PgTypes.CodecError> {
  return Result.succeed(Number(new DataView(bytes.buffer, bytes.byteOffset, INT8_BYTES).getBigInt64(START)));
}

const JSONB_VERSION = 1;
const JSONB_TEXT_START = 1;
const fromUtf8 = new TextDecoder();
const toUtf8 = new TextEncoder();

function readJsonbText(bytes: Bytes): Result.Result<string, PgTypes.CodecError> {
  if (bytes[FIRST_BYTE] !== JSONB_VERSION) {
    return Result.fail(new PgTypes.CodecError({ message: "Unsupported jsonb version byte" }));
  }
  return Result.succeed(fromUtf8.decode(bytes.subarray(JSONB_TEXT_START)));
}

function writeJsonbText(text: string): Result.Result<Uint8Array, PgTypes.CodecError> {
  return Result.succeed(Uint8Array.of(JSONB_VERSION, ...toUtf8.encode(text)));
}

const jsonbAsText: PgTypes.Codec<string> = { decode: readJsonbText, encode: writeJsonbText };

function readBool(bytes: Bytes): Result.Result<number, PgTypes.CodecError> {
  if (bytes[FIRST_BYTE] === FALSE_BYTE) {
    return Result.succeed(FALSE_BIT);
  }
  return Result.succeed(TRUE_BIT);
}

export function sqliteShapedTypes(): PgTypes.Registry {
  const types = PgTypes.makeRegistry();
  types.register(PgTypes.OID.int8, readAs(PgTypes.OID.int8, readInt8));
  types.register(PgTypes.OID.bool, readAs(PgTypes.OID.bool, readBool));
  types.register(PgTypes.OID.jsonb, jsonbAsText);
  return types;
}

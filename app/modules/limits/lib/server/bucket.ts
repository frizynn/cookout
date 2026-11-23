const MILLIS_PER_MINUTE = 60_000;
const MILLIS_PER_SECOND = 1000;
const ONE_TOKEN = 1;

interface Bucket {
  readonly tokens: number;
  readonly atMillis: number;
}

interface Taking {
  readonly bucket: Bucket | undefined;
  readonly perMinute: number;
  readonly nowMillis: number;
}

type Taken =
  | { readonly admitted: true; readonly bucket: Bucket }
  | { readonly admitted: false; readonly bucket: Bucket; readonly retryAfterSeconds: number };

function take({ bucket, nowMillis, perMinute }: Taking): Taken {
  const { atMillis, tokens } = bucket ?? { atMillis: nowMillis, tokens: perMinute };
  const refilled = Math.min(perMinute, tokens + ((nowMillis - atMillis) * perMinute) / MILLIS_PER_MINUTE);
  if (refilled >= ONE_TOKEN) {
    return { admitted: true, bucket: { atMillis: nowMillis, tokens: refilled - ONE_TOKEN } };
  }
  const waitMillis = ((ONE_TOKEN - refilled) * MILLIS_PER_MINUTE) / perMinute;
  return {
    admitted: false,
    bucket: { atMillis: nowMillis, tokens: refilled },
    retryAfterSeconds: Math.ceil(waitMillis / MILLIS_PER_SECOND),
  };
}

export { type Bucket, take };

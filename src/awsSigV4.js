const encoder = new TextEncoder();

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(message) {
  const data = typeof message === 'string' ? encoder.encode(message) : message;
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return toHex(hash);
}

async function hmacRaw(key, message) {
  const rawKey = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return window.crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQueryString(search) {
  if (!search) return '';
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const pairs = [];
  for (const [key, value] of params.entries()) {
    pairs.push([encodeRfc3986(key), encodeRfc3986(value)]);
  }
  pairs.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

function formatAmzDate(date = new Date()) {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

/**
 * Signs an HTTP request with AWS Signature Version 4 in the browser using Web Crypto.
 * Returns headers ready to merge into fetch().
 */
export async function signAwsRequest({
  method = 'GET',
  pathname,
  search = '',
  host,
  body = '',
  region = 'us-east-1',
  service = 'execute-api',
  credentials,
  extraHeaders = {},
}) {
  if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
    throw new Error('AWS temporary credentials (AccessKeyId and SecretAccessKey) are required.');
  }

  const upperMethod = method.toUpperCase();
  const { amzDate, dateStamp } = formatAmzDate();
  const payloadHash = await sha256Hex(body || '');

  const signableHeaders = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...(credentials.sessionToken ? { 'x-amz-security-token': credentials.sessionToken } : {}),
  };

  for (const [k, v] of Object.entries(extraHeaders)) {
    if (v !== undefined && v !== null) {
      signableHeaders[k.toLowerCase()] = String(v).trim();
    }
  }

  const sortedKeys = Object.keys(signableHeaders).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${signableHeaders[k]}\n`).join('');
  const signedHeaders = sortedKeys.join(';');
  const canonicalQuery = canonicalQueryString(search);

  const canonicalRequest = [
    upperMethod,
    pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = await hmacRaw(`AWS4${credentials.secretAccessKey}`, dateStamp);
  const kRegion = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, service);
  const kSigning = await hmacRaw(kService, 'aws4_request');
  const signature = toHex(await hmacRaw(kSigning, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const fetchHeaders = {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: authorization,
  };
  if (credentials.sessionToken) {
    fetchHeaders['x-amz-security-token'] = credentials.sessionToken;
  }
  return fetchHeaders;
}

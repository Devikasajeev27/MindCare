import crypto from "crypto";

function base64url(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const header = { alg: "HS256", typ: "JWT" };
const payload = { id: "6a5c8d993be2146303cbd501", exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) };
const secret = "supersecretjwtkey123_dev_only";

const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
const encodedPayload = base64url(Buffer.from(JSON.stringify(payload)));

const signature = crypto.createHmac('sha256', secret)
  .update(encodedHeader + '.' + encodedPayload)
  .digest();
const encodedSignature = base64url(signature);

const token = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
console.log("Manual token:", token);

async function runTest() {
  try {
    const res = await fetch("http://127.0.0.1:5000/api/auth/profile", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    console.log("Response status:", res.status);
    const body = await res.text();
    console.log("Response body:", body);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

runTest();

import fetch from "node-fetch"; // wait, node-fetch might not be installed, we can use global fetch in Node 18+

async function run() {
  console.log("⚡ Querying local backend endpoints to retrieve error details...");
  try {
    const res = await fetch("http://localhost:5000/api/auth/profile");
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    const body = await res.text();
    console.log("Body:", body);
  } catch (err: any) {
    console.error("Fetch failed:", err.message);
  }
}

run();

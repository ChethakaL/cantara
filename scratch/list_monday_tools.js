const API_KEY = process.env.COMPOSIO_API_KEY;
const BASE_URL = "https://backend.composio.dev/api/v3.1";

async function listTools() {
  const res = await fetch(`${BASE_URL}/actions?app_names=monday`, {
    headers: { "x-api-key": API_KEY }
  });
  const data = await res.json();
  // Filter for slugs containing "ITEM" or "BOARD"
  const slugs = data.items?.map(i => i.slug).filter(s => s.includes("ITEM") || s.includes("BOARD")) || [];
  console.log(JSON.stringify(slugs, null, 2));
}

listTools();

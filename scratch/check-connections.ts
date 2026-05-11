import { getGoogleDriveConnection, ADMIN_DRIVE_USER_ID, GOOGLEDRIVE_TOOLKIT_SLUG } from "../src/lib/composio";

async function check() {
  console.log("Checking Google Drive connections...");
  const conn = await getGoogleDriveConnection();
  console.log("Active connection found:", conn?.id, conn?.status);
  
  // Directly fetch all connections to see what's there
  const COMPOSIO_BASE_URL = "https://backend.composio.dev/api/v3.1";
  const params = new URLSearchParams({
    limit: "50",
    account_type: "ALL",
    user_ids: "cantara-admin-drive",
    toolkit_slugs: "GOOGLEDRIVE",
  });
  
  const res = await fetch(`${COMPOSIO_BASE_URL}/connected_accounts?${params}`, {
    headers: {
      "x-api-key": process.env.COMPOSIO_API_KEY || "",
    }
  });
  
  const data = await res.json();
  console.log("All connections list:");
  data.items?.forEach((item: any) => {
    console.log(`- ID: ${item.id}, Status: ${item.status}, Disabled: ${item.is_disabled}, Updated: ${item.updated_at}`);
  });
}

check().catch(console.error);

const https = require("https");

const API_URL = "https://appifyglobalbackend-production.up.railway.app";
const API_KEY = "your-secret-api-key-for-write-endpoints";

console.log("🔄 Regenerating signed URLs for Railbucket images...\n");

const options = {
  hostname: new URL(API_URL).hostname,
  port: 443,
  path: "/api/admin/regenerate-signed-urls",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  },
};

const req = https.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      const response = JSON.parse(data);
      if (response.success) {
        console.log("✅ Success!");
        console.log(`   ${response.message}\n`);
      } else {
        console.error("❌ Error:", response.error || response.message);
      }
    } catch (e) {
      console.error("❌ Failed to parse response:", data);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Request failed:", error.message);
});

req.end();

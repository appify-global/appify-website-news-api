const https = require("https");

const API_URL = "https://appifyglobalbackend-production.up.railway.app";
const API_KEY = "your-secret-api-key-for-write-endpoints";

console.log("🧪 Testing regenerate-signed-urls endpoint...\n");

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

  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("\nResponse Body:");
    console.log(data);
    
    try {
      const response = JSON.parse(data);
      if (response.success) {
        console.log("\n✅ Success!");
        console.log(`   ${response.message}`);
      } else {
        console.log("\n❌ Error:");
        console.log(`   ${response.error || response.message}`);
      }
    } catch (e) {
      console.log("\n⚠️  Response is not JSON:");
      console.log(data);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Request failed:", error.message);
});

req.end();

/**
 * Script to unpublish articles by slug
 */

const API_URL = process.env.API_URL || "https://appifyglobalbackend-production.up.railway.app";
const API_KEY = process.env.API_KEY || "your-secret-api-key-for-write-endpoints";

const articleSlugs = [
  "ethereum-foundation-believes-in-defipunk-says-org-as-it-forms-team-to-support-protocol-development",
  "chainlinks-taylor-lindman-joins-the-sec-as-chief-counsel-for-the-crypto-task-force",
  "the-daily-ai-agent-accidentally-sends-entire-memecoin-holdings-to-reply-guy-based-raises-dollar115m-in-pantera-led-funding-round-and-more"
];

async function unpublishBySlug() {
  try {
    console.log(`[Script] Unpublishing ${articleSlugs.length} articles by slug...`);
    console.log(`[Script] API URL: ${API_URL}`);
    
    const response = await fetch(`${API_URL}/api/admin/unpublish-articles-by-slug`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        articleSlugs: articleSlugs,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const results = await response.json();
    
    console.log("\n[Script] ===== RESULTS =====");
    if (results.success) {
      console.log(`[Script] ✅ Success: ${results.message}`);
      if (Array.isArray(results.results)) {
        results.results.forEach((result: any, index: number) => {
          console.log(`\n${index + 1}. ${result.slug}`);
          if (result.success) {
            console.log(`   Title: ${result.title}`);
            console.log(`   ✅ Unpublished`);
            console.log(`   New Status: ${result.newStatus}`);
          } else {
            console.log(`   ❌ Failed: ${result.error}`);
          }
        });
      }
    } else {
      console.log("[Script] Response:", JSON.stringify(results, null, 2));
    }
    
  } catch (error: any) {
    console.error("[Script] Error:", error.message);
    process.exit(1);
  }
}

unpublishBySlug();

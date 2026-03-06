// Check existing articles
const https = require('https');

const RAILWAY_URL = 'https://appifyglobalbackend-production.up.railway.app';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(`${RAILWAY_URL}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('📰 Checking existing articles...\n');
  
  try {
    const result = await makeRequest('/api/news?status=published&limit=20');
    const list = result.data?.articles ?? (Array.isArray(result.data) ? result.data : []);
    if (result.status === 200 && list.length >= 0) {
      const total = result.data?.total ?? list.length;
      console.log(`Found ${list.length} published articles (page 1, total ${total}):\n`);
      list.forEach((a, i) => {
        console.log(`${i + 1}. ${a.title}`);
        console.log(`   Slug: ${a.slug}`);
        console.log(`   Topics: ${a.topics}`);
        console.log(`   Created: ${a.timestamp || 'N/A'}\n`);
      });
      
      // Check for the startup accelerator article specifically
      const accelerator = list.find(a => a.slug.includes('startup-accelerator'));
      if (accelerator) {
        console.log('✅ Found startup accelerator article!');
      } else {
        console.log('❌ Startup accelerator article not found in published articles');
      }
    } else {
      console.log('Error fetching articles:', articles.status);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();

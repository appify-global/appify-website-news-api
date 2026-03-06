/**
 * Script to check recently generated articles
 */

const https = require('https');

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://appifyglobalbackend-production.up.railway.app';

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

async function checkArticles() {
  try {
    console.log('📊 Checking recently generated articles...\n');
    
    const result = await makeRequest('/api/news?limit=5');
    
    const list = result.data?.articles ?? (Array.isArray(result.data) ? result.data : []);
    if (result.status === 200 && list.length >= 0) {
      console.log(`Found ${list.length} recent article(s):\n`);
      
      list.forEach((article, index) => {
        console.log(`${index + 1}. ${article.title}`);
        console.log(`   Slug: ${article.slug}`);
        console.log(`   Topics: ${article.topics}`);
        console.log(`   Image: ${article.imageUrl ? article.imageUrl.substring(0, 80) + '...' : 'N/A'}`);
        console.log(`   Status: ${article.status}`);
        console.log(`   Timestamp: ${article.timestamp}\n`);
      });
    } else {
      console.log('No articles found or error occurred.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkArticles();

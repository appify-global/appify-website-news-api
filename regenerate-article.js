/**
 * Regenerate a specific article's content
 * Usage: node regenerate-article.js "Article Title"
 */

require('dotenv').config();
const https = require('https');
const http = require('http');

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://appifyglobalbackend-production.up.railway.app';
const API_KEY = process.env.API_KEY || 'your-secret-api-key-for-write-endpoints';

const articleTitle = process.argv[2] || "Banking AI App Development in Multiple Business Functions at NatWest";

function makeRequest(path, method = 'POST', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${RAILWAY_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    };

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
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
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function regenerateArticle() {
  try {
    console.log(`🔄 Regenerating article: "${articleTitle}"\n`);
    console.log('⏳ This may take 30-60 seconds...\n');
    
    const result = await makeRequest('/api/admin/regenerate-article', 'POST', {
      articleTitle: articleTitle
    });
    
    if (result.status === 200 && result.data.success) {
      console.log(`✅ ${result.data.message}\n`);
      console.log(`📝 Article Details:`);
      console.log(`   Slug: ${result.data.article.slug}`);
      console.log(`   Title: ${result.data.article.title}`);
      console.log(`   Excerpt: ${result.data.article.excerpt}\n`);
      console.log(`✅ Article content has been completely rewritten with NatWest-specific content!`);
    } else {
      console.error('❌ Failed to regenerate article:', result.data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

regenerateArticle();

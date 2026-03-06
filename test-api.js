// Quick test script to check API endpoints
const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function testAPI() {
  console.log('🧪 Testing API Endpoints...\n');
  console.log(`API URL: ${API_URL}\n`);

  // Test 1: Health check
  console.log('1. Testing /health endpoint...');
  try {
    const healthRes = await fetch(`${API_URL}/health`);
    const healthData = await healthRes.json();
    console.log('   ✅ Health check passed:', healthData);
  } catch (error) {
    console.log('   ❌ Health check failed:', error.message);
    console.log('   ⚠️  Make sure backend is running on port 4000');
    return;
  }

  // Test 2: Fetch articles
  console.log('\n2. Testing /api/news endpoint...');
  try {
    const newsRes = await fetch(`${API_URL}/api/news?status=published`);
    if (!newsRes.ok) {
      throw new Error(`HTTP ${newsRes.status}`);
    }
    const data = await newsRes.json();
    const articles = data.articles ?? (Array.isArray(data) ? data : []);
    const total = data.total ?? articles.length;
    const hasMore = data.hasMore ?? data.has_more;
    console.log(`   ✅ Found ${articles.length} published articles (total: ${total}, hasMore: ${!!hasMore})`);
    
    if (articles.length > 0) {
      const first = articles[0];
      console.log('\n   Sample article:');
      console.log(`   - Title: ${first.title}`);
      console.log(`   - Topics: ${first.topics || first.category}`);
      console.log(`   - Slug: ${first.slug}`);
      console.log(`   - Content blocks: ${first.content?.length || 0}`);
      console.log(`   - Featured: ${first.isFeatured}`);
    } else {
      console.log('   ⚠️  No articles found. Run article generation first.');
    }
  } catch (error) {
    console.log('   ❌ Failed to fetch articles:', error.message);
  }

  // Test 3: Check database connection
  console.log('\n3. Testing database connection...');
  try {
    const dbRes = await fetch(`${API_URL}/api/news?limit=1`);
    if (dbRes.ok) {
      console.log('   ✅ Database connection working');
    }
  } catch (error) {
    console.log('   ❌ Database connection failed:', error.message);
  }

  console.log('\n✅ API test complete!');
}

// Use node-fetch if available, otherwise use http
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

testAPI().catch(console.error);

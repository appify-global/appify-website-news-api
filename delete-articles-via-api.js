/**
 * Script to delete 3 specific articles via API
 */

const https = require('https');

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://appifyglobalbackend-production.up.railway.app';
const API_KEY = process.env.API_KEY || 'your-secret-api-key-for-write-endpoints';

// The 3 articles to delete (we'll search for them first)
const articlesToDelete = [
  "Ring Kills Flock Safety Deal After Super Bowl Ad Uproar",
  "AI, Fancy Footwear, and All the Other Gear Powering Olympic Bobsledding",
  "CurrentBody LED Hair Growth Helmet Review: Baby Hairs Abound (2026)"
];

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(`${RAILWAY_URL}${path}`, options, (res) => {
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

async function deleteArticles() {
  try {
    console.log('🔍 Finding articles to delete...\n');

    // Get all articles
    const result = await makeRequest('/api/news?limit=100');
    
    if (result.status !== 200) {
      console.error('❌ Failed to fetch articles:', result.data);
      return;
    }

    const allArticles = result.data?.articles ?? (Array.isArray(result.data) ? result.data : []);
    const articlesToDeleteFound = [];

    // Find articles by title
    for (const title of articlesToDelete) {
      const article = allArticles.find(a => a.title === title);
      if (article) {
        articlesToDeleteFound.push(article);
        console.log(`✅ Found: ${article.title}`);
        console.log(`   Slug: ${article.slug}`);
        console.log(`   Image URL: ${article.imageUrl ? article.imageUrl.substring(0, 80) + '...' : 'N/A'}\n`);
      } else {
        console.log(`⚠️  Not found: ${title}\n`);
      }
    }

    if (articlesToDeleteFound.length === 0) {
      console.log('❌ No articles found to delete.');
      return;
    }

    console.log(`\n🗑️  Deleting ${articlesToDeleteFound.length} article(s)...\n`);

    // Delete each article
    for (const article of articlesToDeleteFound) {
      try {
        const deleteResult = await makeRequest(`/api/news/${article.slug}`, 'DELETE');
        
        if (deleteResult.status === 200 || deleteResult.status === 204) {
          console.log(`✅ Deleted: ${article.slug}`);
          console.log(`   Title: ${article.title}`);
          console.log(`   Image reference removed (image stored in Railbucket)\n`);
        } else {
          console.log(`❌ Failed to delete: ${article.slug}`);
          console.log(`   Status: ${deleteResult.status}`);
          console.log(`   Response: ${JSON.stringify(deleteResult.data)}\n`);
        }
      } catch (error) {
        console.error(`❌ Error deleting ${article.slug}:`, error.message);
      }
    }

    console.log(`\n✅ Deletion complete!`);
    console.log(`Note: Images are stored in Railbucket and will remain there.`);
    console.log(`The article references to those images have been removed.`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

deleteArticles();

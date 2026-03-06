// Simple API test
const http = require('http');

function testAPI() {
  http.get('http://localhost:4000/api/news?status=published', (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        const articles = response.articles ?? (Array.isArray(response) ? response : []);
        console.log(`✅ API is working! Found ${articles.length} published articles\n`);
        
        if (articles.length > 0) {
          const article = articles[0];
          console.log('📰 Sample Article:');
          console.log(`   Title: ${article.title}`);
          console.log(`   Topics: ${article.topics}`);
          console.log(`   Slug: ${article.slug}`);
          console.log(`   Content Blocks: ${article.content?.length || 0}`);
          console.log(`   Status: ${article.status}`);
          console.log(`\n✅ Frontend can fetch this article!`);
        } else {
          console.log('⚠️  No published articles. Articles are in "pending_review" status.');
          console.log('   You can publish them via API or change status in database.');
        }
      } catch (error) {
        console.error('❌ Error parsing response:', error.message);
      }
    });
  }).on('error', (error) => {
    console.error('❌ API test failed:', error.message);
    console.log('   Make sure backend is running on port 4000');
  });
}

testAPI();

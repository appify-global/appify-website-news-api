const https = require('https');

const RAILWAY_URL = 'https://appifyglobalbackend-production.up.railway.app';
const API_KEY = process.env.API_KEY || 'your-secret-api-key-for-write-endpoints';

function makeRequest(path, method = 'GET', body = {}) {
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
    if (method === 'POST' && Object.keys(body).length > 0) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('⚙️  Triggering article generation...\n');

  try {
    const result = await makeRequest('/api/admin/generate', 'POST', {});
    console.log(`   Status: ${result.status}`);
    console.log(`   ${JSON.stringify(result.data, null, 2)}\n`);
    console.log('   ⏳ This may take a few minutes. Check Railway logs for progress.\n');
    console.log('✅ Generation triggered successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure API_KEY is set in your environment or Railway Variables.');
  }
}

main();

// Test filename extraction
const testUrls = [
  "https://t3.storageapi.dev/appify-railbucket-oa2fx2s/ai-app-development-insights-from-clawfms-approach-1770774570146.png",
  "https://t3.storageapi.dev/appify-railbucket-oa2fx2s/harnessing-ai-for-mobile-app-development-in-australia-1770774569932.png"
];

function extractFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    if (pathParts.length >= 2) {
      return pathParts[pathParts.length - 1];
    }
    return null;
  } catch {
    return null;
  }
}

testUrls.forEach(url => {
  const filename = extractFilenameFromUrl(url);
  console.log(`URL: ${url}`);
  console.log(`Filename: ${filename}`);
  console.log('');
});

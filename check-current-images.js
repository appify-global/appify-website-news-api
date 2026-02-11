const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres:SutGuMkPQWYuWNudhUrpDWYWQgfUHYWZ@shortline.proxy.rlwy.net:53169/railway"
    }
  }
});

(async () => {
  const articles = await prisma.article.findMany({
    select: {
      title: true,
      imageUrl: true,
    },
    take: 3,
    orderBy: { createdAt: 'desc' }
  });

  console.log('Current image URLs:\n');
  articles.forEach(a => {
    console.log(`${a.title.substring(0, 50)}...`);
    console.log(`  URL: ${a.imageUrl}`);
    console.log(`  Is signed URL: ${a.imageUrl?.includes('X-Amz') ? '✅' : '❌'}`);
    console.log(`  Contains t3.storageapi.dev: ${a.imageUrl?.includes('t3.storageapi.dev') ? '✅' : '❌'}`);
    console.log('');
  });

  await prisma.$disconnect();
})();

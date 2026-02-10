// Migration script: Convert article_content_blocks table to JSON column
require('dotenv').config();

async function migrateToJSON() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    console.log('🔄 Migrating content blocks to JSON column...\n');
    
    // Get all articles with their content blocks
    const articles = await prisma.$queryRaw`
      SELECT 
        a.id,
        a.slug,
        COALESCE(
          json_agg(
            json_build_object(
              'type', acb.type,
              'text', acb.text,
              'src', acb.src,
              'alt', acb.alt
            ) ORDER BY acb.sort_order
          ) FILTER (WHERE acb.id IS NOT NULL),
          '[]'::json
        ) as content_blocks
      FROM articles a
      LEFT JOIN article_content_blocks acb ON acb.article_id = a.id
      GROUP BY a.id, a.slug
    `;
    
    console.log(`Found ${articles.length} articles to migrate\n`);
    
    // Update each article with JSON content
    for (const article of articles) {
      await prisma.$executeRaw`
        UPDATE articles
        SET content = ${JSON.stringify(article.content_blocks)}::jsonb
        WHERE id = ${article.id}
      `;
      console.log(`✅ Migrated: ${article.slug}`);
    }
    
    console.log(`\n✅ Migration complete! ${articles.length} articles updated.`);
    console.log('\n⚠️  Next steps:');
    console.log('   1. Test the API to ensure content loads correctly');
    console.log('   2. Once verified, you can drop the article_content_blocks table:');
    console.log('      DROP TABLE article_content_blocks;');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

migrateToJSON();

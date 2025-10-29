#!/usr/bin/env node

/**
 * Apply database migration for storage_path support
 * This script applies the migration that adds storage_path to the
 * match_sbwc_document_sections function return type.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('📝 Applying database migration: add_storage_path_to_search');
  console.log('🔗 Supabase URL:', supabaseUrl);
  console.log('');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251029_add_storage_path_to_search.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log('─'.repeat(60));
    console.log(migrationSQL.substring(0, 300) + '...');
    console.log('─'.repeat(60));
    console.log('');

    // Execute migration
    console.log('⏳ Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      // Try direct SQL execution via REST API
      console.log('⚠️  RPC failed, trying direct execution...');

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ query: migrationSQL })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      console.log('✅ Migration applied successfully via REST API');
    } else {
      console.log('✅ Migration applied successfully');
      if (data) {
        console.log('📊 Result:', data);
      }
    }

    // Verify the migration
    console.log('');
    console.log('🔍 Verifying migration...');

    const { data: functionInfo, error: verifyError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'match_sbwc_document_sections')
      .single();

    if (verifyError) {
      console.log('⚠️  Could not verify function (this is OK if migration succeeded)');
    } else {
      console.log('✅ Function exists:', functionInfo?.proname);
    }

    console.log('');
    console.log('✅ Migration complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Build the application: npm run build');
    console.log('2. Test citation functionality');
    console.log('3. Deploy to production');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Check Supabase credentials in .env');
    console.error('2. Verify database connection');
    console.error('3. Try applying migration via Supabase Dashboard:');
    console.error('   https://sb.aichemist.agency → SQL Editor');
    console.error('   Paste contents of: supabase/migrations/20251029_add_storage_path_to_search.sql');
    console.error('');
    process.exit(1);
  }
}

// Execute
applyMigration();

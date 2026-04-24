#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Load environment variables from .env.local
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ .env.local not found at ${filePath}`);
    process.exit(1);
  }

  const envContent = fs.readFileSync(filePath, 'utf-8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^"|"$/g, '');
    env[key.trim()] = value;
  });

  return env;
}

const envVars = loadEnv(path.join(projectRoot, '.env.local'));

// Load environment variables
const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('🔐 Initializing Supabase client...');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Read FCM key
const fcmKeyPath = path.join(__dirname, '..', 'fcm-key.json');
if (!fs.existsSync(fcmKeyPath)) {
  console.error(`❌ FCM key file not found at ${fcmKeyPath}`);
  process.exit(1);
}

console.log(`📖 Reading FCM key from ${fcmKeyPath}...`);
const fcmKeyJson = fs.readFileSync(fcmKeyPath, 'utf-8');

console.log(`📝 FCM key size: ${fcmKeyJson.length} bytes`);
console.log('📤 Inserting into app_secrets table...');

// Insert or update
const { data, error } = await supabase
  .from('app_secrets')
  .upsert(
    { key: 'FCM_PRIVATE_KEY', value: fcmKeyJson },
    { onConflict: 'key' }
  )
  .select();

if (error) {
  console.error('❌ Error inserting FCM secret:', error.message);
  console.error(error);
  process.exit(1);
}

console.log('✅ FCM_PRIVATE_KEY inserted successfully!');
console.log(`📊 Inserted row: ${JSON.stringify(data, null, 2)}`);

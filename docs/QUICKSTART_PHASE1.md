# Quick Start Guide - Phase 1 Backend

## Installation & Setup (5 minutes)

### Step 1: Install Dependencies
```bash
cd /home/jgatlit/projects/BourneLaw/SBWC-chatbot/pinecone-assistant
npm install @supabase/supabase-js
```

### Step 2: Configure Environment Variables
Add to `/home/jgatlit/projects/BourneLaw/SBWC-chatbot/pinecone-assistant/.env`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# OpenAI Configuration
OPENAI_API_KEY="your-openai-api-key"
```

### Step 3: Apply RLS Policies (if not already applied)
Run the migration file on your Supabase database:

```bash
# Via Supabase CLI
supabase db push --db-url "your-connection-string"

# Or manually execute:
# /home/jgatlit/projects/BourneLaw/SBWC-chatbot/pinecone-assistant/supabase/migrations/20251029_chat_history_rls_policies.sql
```

### Step 4: Verify Tables Exist
Ensure these tables exist in your Supabase database:
- `sbwc_chat_sessions`
- `sbwc_chat_messages`

---

## Test the Implementation

### Test in Next.js Dev Server
```bash
npm run dev
```

### Test Server Actions (create test file)

Create `/home/jgatlit/projects/BourneLaw/SBWC-chatbot/pinecone-assistant/test-actions.ts`:

```typescript
import { getOrCreateSession, saveMessage, loadMessageHistory } from './src/app/actions';

async function testChatHistory() {
  console.log('Testing Phase 1 Backend...\n');

  // Test 1: Get or create session
  console.log('1. Getting or creating session...');
  const sessionId = await getOrCreateSession();
  console.log('   Session ID:', sessionId);

  if (!sessionId) {
    console.log('   ❌ Failed: User not authenticated');
    return;
  }
  console.log('   ✅ Success\n');

  // Test 2: Save user message
  console.log('2. Saving user message...');
  const userSaved = await saveMessage(
    sessionId,
    'user',
    'What are the safety requirements for workers?'
  );
  console.log('   Result:', userSaved ? '✅ Success' : '❌ Failed');
  console.log();

  // Test 3: Save assistant message with references
  console.log('3. Saving assistant message with references...');
  const assistantSaved = await saveMessage(
    sessionId,
    'assistant',
    'Safety requirements include proper training, PPE, and compliance with OSHA standards.',
    [
      { name: 'safety-manual.pdf', url: 'https://example.com/safety.pdf', relevance: '92%' },
      { name: 'osha-guidelines.pdf', url: 'https://example.com/osha.pdf', relevance: '87%' }
    ]
  );
  console.log('   Result:', assistantSaved ? '✅ Success' : '❌ Failed');
  console.log();

  // Test 4: Load message history
  console.log('4. Loading message history...');
  const messages = await loadMessageHistory(sessionId);
  console.log('   Messages loaded:', messages.length);

  if (messages.length > 0) {
    console.log('   ✅ Success\n');
    console.log('   Latest messages:');
    messages.slice(-2).forEach((msg, i) => {
      console.log(`   ${i + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
      if (msg.references) {
        console.log(`      References: ${msg.references.length}`);
      }
    });
  } else {
    console.log('   ⚠️  No messages found (might be RLS policy issue)');
  }
}

testChatHistory().catch(console.error);
```

Run test:
```bash
npx tsx test-actions.ts
```

---

## Usage Examples

### In a Server Component
```typescript
import { getOrCreateSession, loadMessageHistory } from '@/app/actions';

export default async function ChatPage() {
  const sessionId = await getOrCreateSession();

  if (!sessionId) {
    return <div>Please sign in to chat</div>;
  }

  const messages = await loadMessageHistory(sessionId);

  return (
    <div>
      <h1>Chat History</h1>
      {messages.map((msg) => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
          {msg.references && (
            <div>
              References: {msg.references.map(r => r.name).join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### In a Server Action (form submission)
```typescript
'use server'

import { saveMessage, getOrCreateSession } from '@/app/actions';

export async function handleChatSubmit(formData: FormData) {
  const sessionId = await getOrCreateSession();

  if (!sessionId) {
    return { error: 'Not authenticated' };
  }

  const message = formData.get('message') as string;

  const success = await saveMessage(sessionId, 'user', message);

  return { success };
}
```

---

## Troubleshooting

### "Missing Supabase environment variables"
- Check `.env` file has all three Supabase variables
- Restart Next.js dev server after updating `.env`

### "Authentication error" or null sessionId
- User is not authenticated
- Check Supabase auth is configured
- Verify auth token cookie (`sb-access-token`) exists

### Empty message history despite saving messages
- RLS policies might not be applied
- Run the migration file: `20251029_chat_history_rls_policies.sql`
- Check user_id matches between session and authenticated user

### "Failed to generate embedding"
- Verify `OPENAI_API_KEY` is set in `.env`
- Check OpenAI API key is valid and has credits

---

## Files Reference

**Implementation Files**:
- Actions: `/home/jgatlit/projects/BourneLaw/SBWC-chatbot/pinecone-assistant/src/app/actions.ts`
- Supabase Utils: `/home/jgatlit/projects/BourneLaw/SBWC-chatbot/pinecone-assistant/src/lib/supabase/server.ts`
- Embedding Utils: `/home/jgatlit/projects/BourneLaw/SBWC-chatbot/pinecone-assistant/src/lib/embedding.ts`

**Configuration Files**:
- Environment: `/home/jgatlit/projects/BourneLaw/SBWC-chatbot/pinecone-assistant/.env`
- Env Example: `/home/jgatlit/projects/BourneLaw/SBWC-chatbot/pinecone-assistant/.env.example`

**Database Files**:
- RLS Policies: `/home/jgatlit/projects/BourneLaw/SBWC-chatbot/pinecone-assistant/supabase/migrations/20251029_chat_history_rls_policies.sql`

**Documentation**:
- Full Summary: `/home/jgatlit/projects/BourneLaw/SBWC-chatbot/PHASE1_BACKEND_IMPLEMENTATION_SUMMARY.md`

---

## Next: Phase 2 Frontend Integration

Once Phase 1 is tested and working:
1. Modify chat component to use server actions
2. Add session ID state management
3. Load message history on mount
4. Save messages after each interaction

See full Phase 1 summary for detailed next steps.

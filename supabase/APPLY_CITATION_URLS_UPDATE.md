# Apply Citation URLs Update to Production

This update adds signed URL generation for PDF citations in chat responses. Users will see clickable URLs to source documents after each LLM response.

## What Changed

### 1. Database Function Update
The `match_sbwc_document_sections` function now returns `storage_path` alongside other fields, enabling signed URL generation.

### 2. Backend Updates
- Updated `DocumentMatch` type to include `storage_path`
- Updated `Citation` type to include `url`, `documentId`, `relevance`, and optional `error`
- Added `generateCitationUrls()` function in `src/lib/rag.ts`
- Updated `chat()` server action to call `generateCitationUrls()` and return citations

### 3. Return Value Change
The `chat()` server action now returns:
```typescript
{
  object: StreamableValue,  // Existing streamed response
  citations: Citation[]      // New: Array of citations with signed URLs
}
```

## Migration File

Location: `supabase/migrations/20251029_add_storage_path_to_search.sql`

## Apply via Supabase Dashboard (Recommended)

1. Go to your Supabase dashboard: https://sb.aichemist.agency
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `supabase/migrations/20251029_add_storage_path_to_search.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Verify success message appears

## Apply via psql CLI (Alternative)

```bash
# From the pinecone-assistant directory
psql "postgresql://postgres:[YOUR_PASSWORD]@db.sb.aichemist.agency:5432/postgres" \
  -f supabase/migrations/20251029_add_storage_path_to_search.sql
```

## Verify Function Updated

After applying, run this query to verify the function returns storage_path:

```sql
SELECT
  p.proname AS function_name,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'match_sbwc_document_sections';
```

You should see `storage_path TEXT` in the return type definition.

## Test the Feature

After applying the migration, test a chat query in your application:

1. Send a question that matches documents (e.g., "What are safety requirements?")
2. Check the server action response includes `citations` array
3. Verify each citation has:
   - `name`: Document filename
   - `documentId`: UUID of the document
   - `url`: Signed URL (or `undefined` if generation failed)
   - `relevance`: Percentage string (e.g., "85.3%")

## Frontend Integration Required

**IMPORTANT:** The backend now returns citations, but the frontend needs to be updated to display them.

Example frontend code to display citations:

```typescript
const { object, citations } = await chat(messages);

// After streaming completes, display citations
if (citations && citations.length > 0) {
  return (
    <div>
      <h4>Sources:</h4>
      <ul>
        {citations.map((citation, i) => (
          <li key={citation.documentId}>
            {citation.url ? (
              <a href={citation.url} target="_blank" rel="noopener noreferrer">
                {citation.name}
              </a>
            ) : (
              <span>{citation.name}</span>
            )}
            <span> ({citation.relevance})</span>
            {citation.error && <span> - Error: {citation.error}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## What This Update Does

- **Generates signed Supabase Storage URLs** for matched documents (1-hour expiry)
- **Deduplicates documents** (same document may have multiple matching sections)
- **Sorts by relevance** (highest similarity first)
- **Handles errors gracefully** (sets `url: undefined` if generation fails)
- **Returns structured citations** alongside the streamed LLM response

## Expected Behavior After Update

✅ Chat responses include `citations` array with signed URLs
✅ Each citation includes document name, relevance score, and clickable URL
✅ URLs expire after 1 hour (configurable via `expirySeconds` parameter)
✅ Citations are sorted by relevance (highest first)
✅ Error handling prevents citation generation failures from breaking chat
✅ Frontend can display clickable PDF links after each response

## Files Modified

### Backend
- `src/lib/types.ts` - Added `storage_path` to `DocumentMatch`, updated `Citation` interface
- `src/lib/rag.ts` - Added `generateCitationUrls()` function
- `src/app/actions.ts` - Updated imports, replaced citation logic with `generateCitationUrls()`, returns citations
- `supabase/migrations/20251029_add_storage_path_to_search.sql` - Database function update

### Database
- `match_sbwc_document_sections` function now returns `storage_path` field

## Next Steps

1. **Apply the migration** using one of the methods above
2. **Test the backend** by sending a chat query and inspecting the response
3. **Update the frontend** to display citations with clickable URLs
4. **Style the citations** to match your application's design

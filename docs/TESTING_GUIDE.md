# PDF Citation URLs - Testing Guide

## Quick Start

**Server Status:** ✅ Running
**Health Check:** http://localhost:3000/api/health
**Application URL:** http://localhost:3000

---

## Test the Citation Feature

### Test 1: Basic Citation Display

1. **Open the chatbot:** http://localhost:3000

2. **Ask a question:**
   ```
   What are the requirements for workers' compensation claims?
   ```
   or
   ```
   Tell me about case 2024028195
   ```

3. **Expected Results:**
   - Response streams normally (word by word)
   - After response completes, citations section appears below
   - Format:
     ```
     ─────────────────────
     Sources:
     📄 2024028195TrialAppeal.pdf (XX.X%)
     📄 [other documents] (XX.X%)
     ```
   - Each document name is a clickable link
   - Relevance percentage shown in parentheses

### Test 2: PDF Download

1. **Click any citation URL**

2. **Expected:**
   - Opens in new browser tab
   - PDF downloads or displays in browser
   - File is readable (not corrupted)
   - Correct document (matches the citation name)

### Test 3: Multiple Citations

1. **Ask a broader question:**
   ```
   What are the general rules for workplace safety?
   ```

2. **Expected:**
   - Multiple document citations (typically 3-5)
   - All have valid URLs
   - Sorted by relevance (highest first)
   - Each has PDF icon and relevance %

### Test 4: Dark Mode

1. **Toggle dark mode** (button in top-right corner)

2. **Ask a question** to trigger citations

3. **Expected:**
   - Citations display properly in dark mode
   - Text readable (good contrast)
   - Icons visible
   - Border colors appropriate

### Test 5: Error Handling Test

**This test verifies graceful degradation:**

1. **Temporarily break storage access:**
   - Stop Supabase service, OR
   - Change storage bucket name in code, OR
   - Just observe if any citations show "(unavailable)"

2. **Ask a question**

3. **Expected:**
   - Response still streams successfully
   - Citations section shows
   - Documents without URLs show warning icon
   - Text says "(unavailable)"
   - No crash or blank screen

---

## Advanced Testing

### Test 6: Citation Accuracy

**Verify citations match what RAG actually used:**

1. Open browser developer console
2. Ask a question
3. Check Network tab for API calls
4. Verify citations match the documents retrieved by RAG

### Test 7: URL Expiry

**Test signed URL expiration (1 hour):**

1. Ask a question and save a citation URL
2. Wait 1 hour
3. Try to access the saved URL
4. **Expected:** URL should be expired (security feature)
5. Re-ask the question to get new valid URLs

### Test 8: Mobile Responsive

1. **Resize browser** to mobile width (< 768px)
2. Ask a question with citations
3. **Expected:**
   - Citations display properly on narrow screens
   - Links are tappable (not too small)
   - Layout doesn't break
   - Icons scale correctly

### Test 9: Performance

1. **Time the response:**
   - Start timer when you send question
   - Stop when citations appear
2. **Expected:**
   - Response streams immediately
   - Citations appear < 500ms after response completes
   - Total time reasonable for document search + LLM generation

---

## Test Data Available

**Documents in Database:** 3+ PDF files
**Sample Documents:**
- 2024028195TrialAppeal.pdf
- 2024020137Trial.pdf
- 2024004211Trial.pdf

**Storage Location:**
```
documents/00000000-0000-0000-0000-000000000001/[document-id]/[filename].pdf
```

---

## Debugging Tips

### If Citations Don't Appear

1. **Check browser console** for errors
2. **Verify migration applied:**
   ```sql
   \df+ match_sbwc_document_sections
   ```
   Should show `storage_path TEXT` in return type

3. **Check server logs:**
   ```bash
   # View dev server output
   tail -f .next/server/app/api/documents/route.js.log
   ```

4. **Verify environment variables:**
   ```bash
   grep SUPABASE .env
   ```

### If URLs Don't Work

1. **Check Supabase Storage bucket:**
   - Bucket name: `sbwc-documents`
   - Verify bucket exists and is accessible

2. **Test storage connection:**
   ```bash
   # In browser console
   fetch('/api/documents')
     .then(r => r.json())
     .then(console.log)
   ```

3. **Verify signed URL generation:**
   - Check server logs for "Failed to generate URL" errors
   - Verify service role key has storage permissions

### If Build Fails

```bash
# Clean build
rm -rf .next node_modules/.cache

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

---

## Manual Test Checklist

Copy and use this checklist:

```
[ ] Server starts successfully (http://localhost:3000)
[ ] Health check returns "healthy"
[ ] Chatbot interface loads
[ ] Can send a message
[ ] Response streams word-by-word
[ ] Citations section appears after response
[ ] Citations have PDF icon
[ ] Citations show relevance percentage
[ ] Citation URLs are clickable
[ ] Clicking citation opens PDF
[ ] PDF is correct document
[ ] Multiple citations display properly
[ ] Dark mode toggle works
[ ] Citations visible in dark mode
[ ] Mobile view (< 768px) works
[ ] Error handling works (if tested)
[ ] No console errors
[ ] No server errors
[ ] Performance is acceptable
```

---

## Expected Console Output

### Successful Citation Generation

```
Vector search completed: 5 matches
Generating citation URLs for 5 documents
✓ Generated URL for 2024028195TrialAppeal.pdf
✓ Generated URL for 2024020137Trial.pdf
✓ Generated URL for 2024004211Trial.pdf
Citations ready: 3 documents
```

### With Errors (Graceful Handling)

```
Vector search completed: 5 matches
Generating citation URLs for 5 documents
⚠ Failed to generate URL for document-id-123: Storage error
✓ Generated URL for 2024020137Trial.pdf
✓ Generated URL for 2024004211Trial.pdf
Citations ready: 2/3 documents (1 failed)
```

---

## Test Results Template

Use this template to document your testing:

```markdown
## Test Results - [Date]

### Environment
- Server: http://localhost:3000
- Database: Connected
- Build: Production / Development

### Test 1: Basic Citation Display
Status: [ PASS / FAIL ]
Notes:

### Test 2: PDF Download
Status: [ PASS / FAIL ]
Notes:

### Test 3: Multiple Citations
Status: [ PASS / FAIL ]
Notes:

### Test 4: Dark Mode
Status: [ PASS / FAIL ]
Notes:

### Test 5: Error Handling
Status: [ PASS / FAIL ]
Notes:

### Performance
- Average response time: _____ seconds
- Citation display delay: _____ ms
- PDF download speed: [ Fast / Medium / Slow ]

### Issues Found
1.
2.
3.

### Overall Assessment
[ READY FOR PRODUCTION / NEEDS FIXES / MORE TESTING NEEDED ]
```

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Mark testing task as complete
2. Deploy to production (if not already deployed)
3. Monitor logs for 24-48 hours
4. Gather user feedback
5. Document any edge cases

### If Issues Found ❌
1. Document specific issues
2. Create GitHub issues or bug reports
3. Prioritize fixes (critical vs. minor)
4. Fix issues and re-test
5. Update documentation with learnings

---

## Support

**Documentation:**
- Implementation: `CITATION_IMPLEMENTATION_COMPLETE.md`
- Deployment: `DEPLOYMENT_COMPLETE.md`
- Database: `SUPABASE_POSTGRES_CLI_CONNECTION_GUIDE.md`

**Logs:**
- Server: Check terminal running `npm run dev`
- Browser: Open Developer Tools → Console
- Database: Check Supabase Dashboard

**Quick Commands:**
```bash
# Stop server
pkill -f "next dev"

# Restart server
npm run dev

# Check database connection
psql "postgresql://postgres:postgres@localhost:5433/postgres?sslmode=disable" -c "SELECT 1;"

# View logs
tail -f ~/.pm2/logs/app-error.log  # if using PM2
```

---

**Happy Testing! 🧪**

The citation feature is deployed and ready to test. Follow the checklist above and document your results.

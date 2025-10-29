# Phase 2: Multi-Session Management - Implementation Plan

## Overview

Phase 2 enhances the chat history system with full session management capabilities, including session listing, creation, deletion, switching, and title management. This transforms the chatbot from single-session to multi-session with a professional sidebar interface.

**Status:** Planning Phase
**Prerequisites:** Phase 1 must be complete and tested
**Estimated Timeline:** 8-12 hours
**Complexity:** Medium

---

## Goals

### Primary Goals
1. **Session List UI** - Sidebar showing all user sessions
2. **Session Switching** - Quick navigation between conversations
3. **Session Creation** - Start new conversations with "New Chat" button
4. **Session Deletion** - Remove unwanted conversations
5. **Session Titles** - Auto-generated or user-editable titles

### Secondary Goals
6. **Session Search** - Find conversations by content or title
7. **Session Export** - Download conversation as PDF/JSON
8. **Session Statistics** - Message count, token usage, timestamps
9. **Session Organization** - Folders, tags, or categories

---

## Architecture

### Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    ChatLayout Component                      │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │   SessionSidebar │  │       ChatInterface              │ │
│  │                  │  │                                  │ │
│  │  [New Chat]      │  │  ┌────────────────────────────┐ │ │
│  │                  │  │  │   Message Display          │ │ │
│  │  Session 1 *     │  │  │   - User messages          │ │ │
│  │  Session 2       │  │  │   - AI responses           │ │ │
│  │  Session 3       │  │  │   - Citations              │ │ │
│  │  Session 4       │  │  └────────────────────────────┘ │ │
│  │  ...             │  │                                  │ │
│  │                  │  │  ┌────────────────────────────┐ │ │
│  │  [Settings]      │  │  │   Input Area               │ │ │
│  │  [Dark Mode]     │  │  └────────────────────────────┘ │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → UI Event → Server Action → Supabase → UI Update

Examples:
1. Click "New Chat" → createNewSession() → INSERT session → Redirect
2. Click session → loadSession() → SELECT messages → Display
3. Delete session → deleteSession() → DELETE cascade → Refresh list
4. Edit title → updateSessionTitle() → UPDATE session → Refresh
```

---

## Database Changes

### New Columns (Optional Enhancements)

**sbwc_chat_sessions table:**
```sql
ALTER TABLE sbwc_chat_sessions
ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'New Chat',
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_message_preview TEXT,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Index for filtering archived sessions
CREATE INDEX IF NOT EXISTS idx_sbwc_chat_sessions_archived
ON sbwc_chat_sessions(user_id, is_archived, updated_at DESC);
```

**Note:** Title column may already exist based on Phase 1. Verify before applying.

### New Functions

**Auto-generate session titles from first message:**
```sql
CREATE OR REPLACE FUNCTION generate_session_title(session_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  first_message TEXT;
  generated_title TEXT;
BEGIN
  -- Get first user message content
  SELECT content INTO first_message
  FROM sbwc_chat_messages
  WHERE session_id = generate_session_title.session_id
    AND role = 'user'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Generate title (first 50 chars + ellipsis)
  IF first_message IS NOT NULL THEN
    IF LENGTH(first_message) > 50 THEN
      generated_title := SUBSTRING(first_message FROM 1 FOR 50) || '...';
    ELSE
      generated_title := first_message;
    END IF;
  ELSE
    generated_title := 'New Chat';
  END IF;

  RETURN generated_title;
END;
$$;
```

**Update message count trigger:**
```sql
CREATE OR REPLACE FUNCTION update_session_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update message count and last message preview
  UPDATE sbwc_chat_sessions
  SET
    message_count = (
      SELECT COUNT(*)
      FROM sbwc_chat_messages
      WHERE session_id = NEW.session_id
    ),
    last_message_preview = SUBSTRING(NEW.content FROM 1 FOR 100),
    updated_at = NOW()
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_session_message_count
AFTER INSERT ON sbwc_chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_session_message_count();
```

---

## Server Actions

### New Actions Required

**File:** `src/app/actions.ts`

```typescript
/**
 * Get all sessions for the current user
 */
export async function getUserSessions(): Promise<ChatSession[]> {
  // Fetch all sessions ordered by updated_at DESC
  // Return: id, title, message_count, last_message_preview, updated_at
}

/**
 * Create a new chat session
 */
export async function createNewSession(title?: string): Promise<string | null> {
  // Create new session with optional title
  // Return: new session ID
}

/**
 * Delete a chat session (cascade deletes messages)
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  // Verify ownership via RLS
  // Delete session (CASCADE will delete messages)
  // Return: success boolean
}

/**
 * Update session title
 */
export async function updateSessionTitle(
  sessionId: string,
  newTitle: string
): Promise<boolean> {
  // Update session title
  // Return: success boolean
}

/**
 * Generate session title from first message
 */
export async function autoGenerateTitle(sessionId: string): Promise<string> {
  // Call generate_session_title() PostgreSQL function
  // Update session with generated title
  // Return: generated title
}

/**
 * Archive/unarchive a session
 */
export async function toggleArchiveSession(
  sessionId: string,
  isArchived: boolean
): Promise<boolean> {
  // Update is_archived field
  // Return: success boolean
}
```

### Type Definitions

```typescript
export type ChatSession = {
  id: string;
  title: string;
  messageCount: number;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
};
```

---

## Frontend Components

### 1. ChatLayout Component

**File:** `src/app/components/ChatLayout.tsx`

**Responsibilities:**
- Overall layout with sidebar and chat area
- Manages active session state
- Coordinates between sidebar and chat interface
- Handles responsive behavior (mobile sidebar toggle)

**Props:**
```typescript
interface ChatLayoutProps {
  initialSessionId?: string;
}
```

**State:**
```typescript
const [sessions, setSessions] = useState<ChatSession[]>([]);
const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
const [sidebarOpen, setSidebarOpen] = useState<boolean>(true); // Desktop: true, Mobile: false
const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
```

---

### 2. SessionSidebar Component

**File:** `src/app/components/SessionSidebar.tsx`

**Responsibilities:**
- Display list of sessions
- "New Chat" button
- Session selection
- Session deletion (with confirmation)
- Search/filter sessions
- Settings and dark mode toggle

**Props:**
```typescript
interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRefreshSessions: () => void;
  isOpen: boolean;
  onToggle: () => void;
}
```

**UI Elements:**
```tsx
<aside className="sidebar">
  {/* Header */}
  <div className="sidebar-header">
    <h2>SBWC Chatbot</h2>
    <button onClick={onNewSession}>+ New Chat</button>
  </div>

  {/* Session List */}
  <div className="session-list">
    {sessions.map(session => (
      <SessionListItem
        key={session.id}
        session={session}
        isActive={session.id === activeSessionId}
        onClick={() => onSessionSelect(session.id)}
        onDelete={() => onDeleteSession(session.id)}
      />
    ))}
  </div>

  {/* Footer */}
  <div className="sidebar-footer">
    <button onClick={toggleDarkMode}>🌙 Dark Mode</button>
    <a href="/documents">📄 Documents</a>
  </div>
</aside>
```

---

### 3. SessionListItem Component

**File:** `src/app/components/SessionListItem.tsx`

**Responsibilities:**
- Display single session in list
- Session title (editable on click)
- Last message preview
- Delete button (hover to reveal)
- Active state styling

**Props:**
```typescript
interface SessionListItemProps {
  session: ChatSession;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}
```

**UI Structure:**
```tsx
<div
  className={`session-item ${isActive ? 'active' : ''}`}
  onClick={onClick}
>
  {/* Title (editable) */}
  {isEditing ? (
    <input
      value={title}
      onChange={handleTitleChange}
      onBlur={handleTitleSave}
    />
  ) : (
    <h3 onDoubleClick={handleEditTitle}>{session.title}</h3>
  )}

  {/* Preview */}
  <p className="preview">{session.lastMessagePreview}</p>

  {/* Metadata */}
  <div className="metadata">
    <span>{session.messageCount} messages</span>
    <span>{formatTimestamp(session.updatedAt)}</span>
  </div>

  {/* Delete button (hover) */}
  <button
    className="delete-btn"
    onClick={(e) => {
      e.stopPropagation();
      onDelete();
    }}
  >
    🗑️
  </button>
</div>
```

---

### 4. Update ChatInterface Component

**File:** `src/app/home.tsx` → Refactor to `src/app/components/ChatInterface.tsx`

**Changes:**
- Remove session management logic (move to ChatLayout)
- Receive `sessionId` and `messages` as props
- Emit events for new messages (for parent to save)
- Focus on message display and input handling

**Props:**
```typescript
interface ChatInterfaceProps {
  sessionId: string;
  messages: Message[];
  onSendMessage: (content: string) => void;
  showCitations: boolean;
  showAssistantFiles: boolean;
}
```

---

## Styling

### Sidebar Styles

**Responsive Breakpoints:**
- Desktop (>= 1024px): Sidebar always visible, 300px width
- Tablet (768px - 1023px): Sidebar toggleable, 280px width
- Mobile (< 768px): Sidebar overlay, full width

**CSS/Tailwind Classes:**
```css
/* Desktop */
.sidebar {
  @apply w-[300px] h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700;
}

/* Mobile Overlay */
@media (max-width: 1023px) {
  .sidebar {
    @apply fixed inset-y-0 left-0 z-50 transform transition-transform;
  }

  .sidebar.closed {
    @apply -translate-x-full;
  }
}

/* Session Item */
.session-item {
  @apply p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors;
}

.session-item.active {
  @apply bg-indigo-50 dark:bg-indigo-900 border-l-4 border-indigo-500;
}

/* Delete Button (hidden by default, show on hover) */
.session-item .delete-btn {
  @apply opacity-0 transition-opacity;
}

.session-item:hover .delete-btn {
  @apply opacity-100;
}
```

---

## User Flows

### Flow 1: New User First Visit
1. Page loads → No session exists
2. `getOrCreateSession()` creates first session
3. Welcome message: "Start a conversation..."
4. User types first message
5. Auto-generate title from first message
6. Session appears in sidebar with title

### Flow 2: Returning User
1. Page loads → Load last active session from localStorage
2. Display session list in sidebar
3. Load messages for active session
4. User continues conversation or switches sessions

### Flow 3: Switch Session
1. User clicks session in sidebar
2. Save current scroll position
3. Load new session messages
4. Display new conversation
5. Update URL (optional: `/chat/[sessionId]`)

### Flow 4: Delete Session
1. User clicks delete button on session
2. Show confirmation modal: "Delete this conversation?"
3. If confirmed → Call `deleteSession()`
4. Remove from UI
5. If deleted session was active → Load most recent session

### Flow 5: New Chat
1. User clicks "New Chat" button
2. Create new session via `createNewSession()`
3. Switch to new session (empty state)
4. Focus input field
5. User starts typing

---

## Implementation Checklist

### Backend (Server Actions)
- [ ] `getUserSessions()` - Fetch all user sessions
- [ ] `createNewSession()` - Create new session
- [ ] `deleteSession()` - Delete session with cascade
- [ ] `updateSessionTitle()` - Update session title
- [ ] `autoGenerateTitle()` - Generate title from first message
- [ ] `toggleArchiveSession()` - Archive/unarchive session
- [ ] Add ChatSession type definition
- [ ] Update existing actions to use session context

### Database
- [ ] Add optional columns (title, message_count, etc.)
- [ ] Create `generate_session_title()` function
- [ ] Create trigger for message count updates
- [ ] Add indexes for performance
- [ ] Test RLS policies with new operations

### Frontend Components
- [ ] Create `ChatLayout.tsx` - Main layout wrapper
- [ ] Create `SessionSidebar.tsx` - Session list sidebar
- [ ] Create `SessionListItem.tsx` - Individual session item
- [ ] Refactor `home.tsx` → `ChatInterface.tsx`
- [ ] Add confirmation modal component
- [ ] Add session search/filter component

### Styling
- [ ] Sidebar responsive layout (desktop/mobile)
- [ ] Session item hover states
- [ ] Active session styling
- [ ] Dark mode support for all new components
- [ ] Mobile hamburger menu for sidebar toggle
- [ ] Smooth transitions and animations

### State Management
- [ ] Session list state in ChatLayout
- [ ] Active session tracking
- [ ] Sidebar open/close state (mobile)
- [ ] Session search/filter state
- [ ] Loading states for all operations

### Integration
- [ ] Connect ChatLayout with existing home page
- [ ] Update routing (optional: dynamic routes)
- [ ] Persist active session in localStorage
- [ ] Handle session switching smoothly
- [ ] Auto-generate titles on first message

### Testing
- [ ] Create new session
- [ ] Switch between sessions
- [ ] Delete session (with confirmation)
- [ ] Edit session title
- [ ] Auto-generate title
- [ ] Archive/unarchive session
- [ ] Mobile responsive behavior
- [ ] Dark mode compatibility
- [ ] RLS policy enforcement
- [ ] Performance with 100+ sessions

---

## Performance Considerations

### Optimization Strategies

**1. Lazy Load Messages**
- Only load message history when session is selected
- Don't preload all messages for all sessions
- Cache loaded sessions in React state

**2. Virtual Scrolling for Session List**
- If user has 100+ sessions, use virtual scrolling
- Render only visible session items
- Use libraries like `react-window` or `react-virtualized`

**3. Debounce Title Updates**
- Debounce title input changes (300ms)
- Batch updates to reduce database writes

**4. Pagination for Messages**
- Load recent 50 messages initially
- "Load More" button for older messages
- Infinite scroll for seamless UX

**5. Client-Side Caching**
- Cache session list in memory
- Invalidate on create/delete/update
- Reduce unnecessary server round-trips

---

## Testing Strategy

### Unit Tests
- Server actions (getUserSessions, createNewSession, etc.)
- Session list filtering/sorting logic
- Title generation function
- Delete confirmation logic

### Integration Tests
- Create → View → Delete session flow
- Session switching preserves state
- Auto-title generation on first message
- RLS policies prevent cross-user access

### E2E Tests (Playwright)
1. **New user journey**: Create first session, send message, verify title
2. **Multi-session**: Create 3 sessions, switch between them, verify messages
3. **Delete session**: Delete active session, verify redirect to another session
4. **Mobile**: Toggle sidebar, select session, verify responsive behavior
5. **Edit title**: Double-click title, edit, verify save

---

## Migration from Phase 1 to Phase 2

### Code Changes Required

**1. Refactor home.tsx**
```tsx
// Before (Phase 1)
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // ... session management mixed with UI
}

// After (Phase 2)
// home.tsx becomes a wrapper that renders ChatLayout
export default function Home() {
  return <ChatLayout />;
}

// ChatInterface.tsx handles message display
export function ChatInterface({ sessionId, messages, onSendMessage }: Props) {
  // ... focused on message display only
}

// ChatLayout.tsx handles session orchestration
export function ChatLayout() {
  // ... manages sessions and coordinates components
}
```

**2. Move Session Logic**
- Session initialization → ChatLayout
- Session state → ChatLayout
- Message loading → ChatLayout
- Message saving → ChatLayout (delegates to ChatInterface callback)

**3. Update Imports**
```tsx
// Old
import { getOrCreateSession, loadMessageHistory, saveMessage } from './actions';

// New (add)
import { getUserSessions, createNewSession, deleteSession } from './actions';
```

---

## Timeline Breakdown

### Day 1: Backend (3-4 hours)
- Hour 1: Database migrations (columns, functions, triggers)
- Hour 2: Server actions (getUserSessions, createNewSession, deleteSession)
- Hour 3: Server actions (updateSessionTitle, autoGenerateTitle)
- Hour 4: Testing and refinement

### Day 2: Frontend Components (4-5 hours)
- Hour 1: ChatLayout scaffolding
- Hour 2: SessionSidebar component
- Hour 3: SessionListItem component
- Hour 4: Refactor home.tsx → ChatInterface
- Hour 5: Integration and wiring

### Day 3: Styling & Polish (2-3 hours)
- Hour 1: Responsive sidebar layout
- Hour 2: Dark mode support
- Hour 3: Animations and transitions

### Day 4: Testing & Refinement (2-3 hours)
- Hour 1: Unit and integration tests
- Hour 2: E2E tests (Playwright)
- Hour 3: Bug fixes and polish

**Total: 11-15 hours** (adjust based on complexity and team size)

---

## Risks & Mitigation

### Risk 1: Performance with Many Sessions
**Mitigation:**
- Implement virtual scrolling for session list
- Add pagination (load 20 sessions at a time)
- Index database queries properly

### Risk 2: Complex State Management
**Mitigation:**
- Consider using Zustand or Jotai for global state
- Keep session list state in ChatLayout
- Use React Context for theme/settings

### Risk 3: Mobile UX Complexity
**Mitigation:**
- Design mobile-first
- Test on real devices early
- Use overlay sidebar pattern (proven UX)

### Risk 4: Session Title Collision
**Mitigation:**
- Auto-generate unique titles with timestamp if collision
- Allow users to edit titles manually
- Show timestamp in UI to differentiate

---

## Future Enhancements (Phase 3+)

### Phase 3: Advanced Features
1. **Session Search** - Full-text search across all messages
2. **Session Export** - Download as PDF, JSON, or TXT
3. **Session Sharing** - Share conversation via link (with permissions)
4. **Session Folders** - Organize sessions into categories
5. **Session Tags** - Tag sessions for organization

### Phase 4: Collaboration
1. **Shared Sessions** - Multiple users in same conversation
2. **Session Comments** - Add notes to conversations
3. **Session Analytics** - Track usage metrics

### Phase 5: AI Enhancements
1. **Smart Titles** - Use AI to generate descriptive titles
2. **Session Summarization** - AI-generated conversation summaries
3. **Session Recommendations** - Suggest related past conversations

---

## Success Metrics

### Quantitative Metrics
- **Session Creation Rate**: Target > 80% of users create multiple sessions
- **Session Switch Rate**: Average 5+ session switches per user per week
- **Session Deletion Rate**: < 20% of sessions deleted (indicates useful feature)
- **Time to Find Session**: < 5 seconds average
- **Mobile Usage**: > 30% of sessions accessed on mobile

### Qualitative Metrics
- User feedback on session organization
- Reported ease of finding past conversations
- Satisfaction with title generation
- Mobile usability ratings

---

## Documentation Requirements

### Developer Documentation
- [ ] API documentation for new server actions
- [ ] Component API documentation (props, events)
- [ ] State management architecture
- [ ] Database schema updates
- [ ] Migration guide from Phase 1

### User Documentation
- [ ] How to create new sessions
- [ ] How to switch between conversations
- [ ] How to delete sessions
- [ ] How to edit session titles
- [ ] Mobile usage guide

---

## Conclusion

Phase 2 transforms the SBWC chatbot from a single-conversation interface into a full-featured multi-session chat application with professional session management. The implementation builds directly on Phase 1's foundation, requiring no breaking changes to existing functionality.

**Key Benefits:**
- ✅ Organized conversation history
- ✅ Easy navigation between topics
- ✅ Professional UI/UX
- ✅ Mobile-friendly
- ✅ Scalable architecture
- ✅ Production-ready patterns

**Recommended Approach:**
1. Complete Phase 1 and test thoroughly
2. Implement Phase 2 backend first (server actions)
3. Build frontend components incrementally
4. Test on mobile devices early
5. Gather user feedback and iterate

**Estimated Delivery:** 2-3 days for experienced team, 3-5 days for learning/exploration included.

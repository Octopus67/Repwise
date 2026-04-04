# Repwise Development Agent - Production Architecture

**Based on research of GitHub Copilot, Cursor, Sourcegraph, and academic papers**

---

## Executive Summary

Build a **multi-layered persistent development agent** that combines:
1. **Code Intelligence** (LSP + tree-sitter + knowledge graph)
2. **Semantic Search** (vector embeddings + RAG)
3. **Persistent Memory** (file-based + vector store + Redis)
4. **Automated Testing** (TDD loop + security scanning)
5. **Self-Correcting Workflows** (test → fix → verify)

**Expected outcome:** 10x faster development, zero context loss, automated quality gates.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    REPWISE DEV AGENT                         │
│                  (LangGraph Orchestrator)                    │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Planning   │  Execution   │ Verification │   Learning     │
│   Module     │  Module      │  Module      │   Module       │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
┌──────▼──────────────▼──────────────▼────────────────▼───────┐
│                  KNOWLEDGE LAYER                             │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Code Intel  │ Vector Store │ Knowledge    │ Persistent     │
│ (LSP+SCIP)  │ (Embeddings) │ Graph        │ Memory         │
├─────────────┼──────────────┼──────────────┼────────────────┤
│ • tsserver  │ • Nomic Code │ • Call graph │ • .kiro/memory/│
│ • Pyright   │ • ChromaDB   │ • Deps map   │ • Redis cache  │
│ • tree-sit  │ • RAG pipe   │ • Symbol refs│ • Event log    │
└─────────────┴──────────────┴──────────────┴────────────────┘
```

---

## Layer 1: Code Intelligence (Foundation)

### 1.1 LSP Integration
**Purpose:** Real-time semantic understanding of code

**Implementation:**
```typescript
// .kiro/lsp-config.json
{
  "servers": {
    "typescript": {
      "command": "typescript-language-server",
      "args": ["--stdio"],
      "rootPath": "/Users/manavmht/Documents/HOS/app"
    },
    "python": {
      "command": "pyright-langserver",
      "args": ["--stdio"],
      "rootPath": "/Users/manavmht/Documents/HOS"
    }
  }
}
```

**Capabilities:**
- Go-to-definition (find where functions are defined)
- Find references (find all usages)
- Hover info (get type information)
- Diagnostics (TypeScript/Python errors in real-time)
- Code actions (auto-fix suggestions)

**Agent Usage:**
```
Agent: "Where is the rest timer auto-start logic?"
LSP: go-to-definition("startRestTimer") → ActiveWorkoutScreen.tsx:607
Agent: "Show me all places that call this"
LSP: find-references("startRestTimer") → 3 locations
```

### 1.2 Tree-Sitter Parsing
**Purpose:** AST-level code understanding for all languages

**Implementation:**
```bash
# Install tree-sitter CLI
npm install -g tree-sitter-cli

# Install language grammars
npm install tree-sitter-typescript tree-sitter-python
```

**Use Cases:**
- Extract function signatures
- Find all React components
- Identify all API endpoints
- Parse JSONB column definitions
- Detect code patterns

**Agent Usage:**
```
Agent: "Find all FastAPI POST endpoints"
Tree-sitter: Parse all .py files → filter @router.post decorators → return list
```

### 1.3 Knowledge Graph (120x Token Reduction)
**Purpose:** Structural code relationships without reading full files

**Implementation:**
```bash
# Use CodeGraphContext MCP server
npm install -g @deusdata/codebase-memory-mcp

# Index codebase
codebase-memory index /Users/manavmht/Documents/HOS
```

**Graph Schema:**
```
Nodes: Function, Class, Component, APIEndpoint, Model, Hook
Edges: CALLS, IMPORTS, EXTENDS, USES, RENDERS

Example queries:
- "Which components use useDashboardData?"
- "What functions call api.post?"
- "Show me the call chain from DashboardScreen to backend"
```

**Storage:** SQLite (embedded, fast, portable)

---

## Layer 2: Semantic Search (RAG Pipeline)

### 2.1 Code Embedding Model
**Choice:** **Nomic Embed Code** (open-source, SOTA)
- 7B parameters, 2K context, Apache 2.0 license
- Outperforms Voyage-Code by 20%+ on code retrieval benchmarks
- Self-hostable (no API costs)

**Alternative:** VoyageCode3 (API, best overall but $$$)

### 2.2 Chunking Strategy
**AST-Aware Chunking:**
```python
# Use tree-sitter to split at semantic boundaries
def chunk_code(file_path):
    tree = parse_file(file_path)
    chunks = []
    
    for node in tree.root_node.children:
        if node.type in ['function_definition', 'class_definition']:
            chunks.append({
                'code': node.text,
                'type': node.type,
                'name': extract_name(node),
                'file': file_path,
                'line_start': node.start_point[0],
                'line_end': node.end_point[0],
            })
    
    return chunks
```

**Chunk Metadata:**
- File path
- Function/class name
- Language
- Last modified timestamp
- Git blame (author, commit)
- Imports/dependencies

### 2.3 Vector Database
**Choice:** **ChromaDB** (for prototyping) → **Weaviate** (for production)

**Why ChromaDB:**
- Lightweight, embedded
- Python-native
- Good for local development

**Why Weaviate (production):**
- Hybrid search (vector + keyword) built-in
- Scales to millions of vectors
- Multi-tenancy support
- GraphQL API

**Implementation:**
```python
import chromadb
from chromadb.utils import embedding_functions

# Initialize
client = chromadb.PersistentClient(path=".kiro/vector-db")
nomic_ef = embedding_functions.NomicEmbeddingFunction(
    api_key="YOUR_KEY",  # or use local model
    model_name="nomic-embed-code-v1.5"
)

collection = client.get_or_create_collection(
    name="repwise_code",
    embedding_function=nomic_ef,
    metadata={"description": "Repwise codebase embeddings"}
)

# Index code
for chunk in chunks:
    collection.add(
        documents=[chunk['code']],
        metadatas=[{
            'file': chunk['file'],
            'name': chunk['name'],
            'type': chunk['type'],
        }],
        ids=[f"{chunk['file']}:{chunk['line_start']}"]
    )

# Query
results = collection.query(
    query_texts=["How does rest timer auto-start work?"],
    n_results=5
)
```

### 2.4 Hybrid Search
**Combine:**
- Vector similarity (semantic understanding)
- BM25 keyword matching (exact term matches)
- Recency weighting (recent changes more relevant)
- File proximity (files in same directory)

**Formula:**
```
score = 0.6 * vector_similarity + 0.3 * bm25_score + 0.1 * recency_weight
```

---

## Layer 3: Persistent Memory System

### 3.1 File-Based Memory (Immediate Context)
**Location:** `.kiro/memory/`

**Structure:**
```
.kiro/memory/
├── codebase-map.md          # Architecture overview (always loaded)
├── recent-changes.md         # Last 30 days of changes
├── conventions.md            # Project patterns and standards
├── gotchas.md                # Known pitfalls and edge cases
├── active-tasks.md           # Current work in progress
└── modules/
    ├── training.md           # Training module deep dive
    ├── nutrition.md          # Nutrition module deep dive
    ├── auth.md               # Auth module deep dive
    └── ...
```

**Auto-loaded on agent startup** (inclusion: always in Kiro config)

### 3.2 Vector-Based Memory (Semantic Retrieval)
**Purpose:** Find relevant past experiences

**Storage:**
```python
# Store each development session as a memory
memory = {
    'timestamp': '2026-03-10T00:00:00',
    'task': 'Fix infinite loop on dashboard',
    'solution': 'Removed loadDashboardData from useEffect deps',
    'files_changed': ['app/screens/dashboard/DashboardScreen.tsx'],
    'outcome': 'success',
    'lessons': ['useCallback deps can cause infinite loops if function recreated every render']
}

# Embed and store
embedding = embed_text(memory['task'] + ' ' + memory['solution'])
vector_db.add(embedding, metadata=memory)

# Retrieve similar past experiences
query = "Dashboard is making too many API calls"
similar_memories = vector_db.search(query, top_k=3)
```

### 3.3 Redis for Session State
**Purpose:** Fast access to current session context

**Schema:**
```
repwise:session:{session_id}:current_file
repwise:session:{session_id}:open_files
repwise:session:{session_id}:recent_edits
repwise:session:{session_id}:test_results
repwise:session:{session_id}:active_branch
```

**TTL:** 24 hours (auto-expire stale sessions)

### 3.4 Event Log (Immutable Audit Trail)
**Purpose:** Complete history of all agent actions

**Storage:** Append-only log file

```jsonl
{"ts":"2026-03-10T00:00:00","action":"file_read","file":"ActiveWorkoutScreen.tsx","reason":"investigating rest timer"}
{"ts":"2026-03-10T00:01:00","action":"file_edit","file":"ActiveWorkoutScreen.tsx","lines":[607-613],"change":"added auto-start logic"}
{"ts":"2026-03-10T00:02:00","action":"test_run","command":"npx tsc --noEmit","result":"success","errors":0}
{"ts":"2026-03-10T00:03:00","action":"commit","hash":"7b283d4","message":"fix: auto-start rest timer"}
```

**Benefits:**
- Debugging: "What did the agent do before the bug appeared?"
- Learning: "How did we solve similar problems before?"
- Accountability: Full audit trail

---

## Layer 4: Automated Testing & Quality Gates

### 4.1 Test Generation Pipeline

**Workflow:**
```
1. Agent makes code change
2. Analyze change impact (call graph + dependency map)
3. Generate tests for affected code paths
4. Run tests
5. If failures: analyze → fix → goto 4
6. If pass: proceed
```

**Test Generation Strategies:**
- **Property-based:** Use Hypothesis (Python) / fast-check (TypeScript)
- **Snapshot:** Capture output before/after
- **Mutation:** Introduce bugs, verify tests catch them
- **Coverage-guided:** Generate tests for uncovered branches

### 4.2 Security Scanning (Automated)

**Pre-commit hooks:**
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run Semgrep SAST
semgrep --config auto --error

# Check dependencies
npm audit --audit-level=high
pip-audit

# Scan for secrets
gitleaks detect --no-git

# If any fail, block commit
```

### 4.3 Smoke Test Suite (Auto-Generated)

**Critical Paths:**
```typescript
// Auto-generated from agent analysis
describe('Critical User Flows', () => {
  test('Auth: Register → Onboarding → Dashboard', async () => {
    // Generated based on navigation graph
  });
  
  test('Workout: Start → Log Sets → Finish → Summary', async () => {
    // Generated based on ActiveWorkoutScreen flow
  });
  
  test('Nutrition: Search → Select → Log → Budget Updates', async () => {
    // Generated based on AddNutritionModal flow
  });
});
```

### 4.4 Continuous Verification

**After every change:**
1. TypeScript compilation (`tsc --noEmit`)
2. Python type checking (`mypy src/`)
3. Linting (`eslint`, `ruff`)
4. Unit tests (affected modules only)
5. Integration tests (if API changed)
6. Smoke tests (critical paths)

**Parallel execution:** Run all checks concurrently, fail fast

---

## Layer 5: Agent Workflows (Self-Correcting)

### 5.1 Feature Development Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. UNDERSTAND                                           │
│    - Load relevant context from knowledge graph         │
│    - Find similar past implementations                  │
│    - Identify affected files via dependency map         │
├─────────────────────────────────────────────────────────┤
│ 2. PLAN                                                 │
│    - Generate implementation plan                       │
│    - Identify risks via architectural drift detection   │
│    - Estimate impact (files changed, tests needed)      │
├─────────────────────────────────────────────────────────┤
│ 3. IMPLEMENT                                            │
│    - Make code changes in shadow workspace              │
│    - Validate against LSP (no new errors)               │
│    - Generate tests automatically                       │
├─────────────────────────────────────────────────────────┤
│ 4. TEST                                                 │
│    - Run generated tests                                │
│    - Run affected existing tests                        │
│    - Run smoke tests                                    │
│    - If failures: analyze → fix → goto 4               │
├─────────────────────────────────────────────────────────┤
│ 5. SECURITY                                             │
│    - Run Semgrep SAST                                   │
│    - Check dependencies (npm audit, pip-audit)          │
│    - Scan for secrets (gitleaks)                        │
│    - If issues: fix → goto 5                           │
├─────────────────────────────────────────────────────────┤
│ 6. VERIFY                                               │
│    - Independent audit (separate agent reviews code)    │
│    - Check for: logic errors, edge cases, performance   │
│    - If issues: fix → goto 6                           │
├─────────────────────────────────────────────────────────┤
│ 7. COMMIT                                               │
│    - Generate descriptive commit message                │
│    - Update knowledge base with learnings               │
│    - Log to event log                                   │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Bug Fix Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. REPRODUCE                                            │
│    - Load bug report context                            │
│    - Search event log for similar past bugs             │
│    - Generate reproduction test                         │
├─────────────────────────────────────────────────────────┤
│ 2. LOCATE                                               │
│    - Use knowledge graph to find relevant code          │
│    - Check call graph for potential causes              │
│    - Review recent changes (git blame + event log)      │
├─────────────────────────────────────────────────────────┤
│ 3. FIX                                                  │
│    - Apply minimal fix                                  │
│    - Validate with LSP                                  │
│    - Ensure reproduction test now passes                │
├─────────────────────────────────────────────────────────┤
│ 4. REGRESSION TEST                                      │
│    - Run full test suite                                │
│    - Check for unintended side effects                  │
│    - If new failures: analyze → fix → goto 4           │
├─────────────────────────────────────────────────────────┤
│ 5. DOCUMENT                                             │
│    - Add to gotchas.md if it's a common pitfall        │
│    - Update relevant module context                     │
│    - Store in vector memory for future reference        │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Goal:** Basic code intelligence and persistent memory

**Tasks:**
1. Set up tree-sitter for TypeScript + Python
2. Create file-based memory system (`.kiro/memory/`)
3. Write codebase map and module context files
4. Create agent initialization script

**Deliverables:**
- Agent loads full context on startup
- Can navigate codebase via tree-sitter queries
- Persistent memory across sessions

### Phase 2: Semantic Search (Week 2)
**Goal:** RAG pipeline for code search

**Tasks:**
1. Set up ChromaDB locally
2. Implement AST-aware chunking
3. Generate embeddings with Nomic Embed Code
4. Build hybrid search (vector + BM25)
5. Create query interface

**Deliverables:**
- Agent can semantically search codebase
- "Find code that handles OAuth" → relevant files
- 10x faster than manual search

### Phase 3: Knowledge Graph (Week 3)
**Goal:** Structural code relationships

**Tasks:**
1. Install CodeGraphContext MCP server
2. Index full codebase (frontend + backend)
3. Build query interface for common patterns
4. Integrate with agent planning module

**Deliverables:**
- Agent understands code relationships
- Can answer: "What depends on this function?"
- Impact analysis for changes

### Phase 4: LSP Integration (Week 4)
**Goal:** Real-time semantic understanding

**Tasks:**
1. Set up tsserver and Pyright
2. Create LSP client wrapper
3. Integrate with agent execution module
4. Add diagnostics monitoring

**Deliverables:**
- Agent gets real-time type information
- Can validate changes before applying
- Zero TypeScript/Python errors guaranteed

### Phase 5: Automated Testing (Week 5)
**Goal:** Self-correcting test loop

**Tasks:**
1. Build test generator (property-based + snapshot)
2. Create smoke test suite
3. Implement test → fix → verify loop
4. Add coverage tracking

**Deliverables:**
- Agent generates tests automatically
- Self-corrects until all tests pass
- No manual test writing needed

### Phase 6: Security & Quality (Week 6)
**Goal:** Automated security and quality gates

**Tasks:**
1. Integrate Semgrep for SAST
2. Add dependency scanning (npm audit, pip-audit)
3. Set up pre-commit hooks
4. Create security dashboard

**Deliverables:**
- Zero security vulnerabilities
- Automated dependency updates
- Quality gates enforced

### Phase 7: Advanced Features (Week 7-8)
**Goal:** Production-grade capabilities

**Tasks:**
1. Shadow workspace for safe experimentation
2. Multi-agent parallelism (isolated worktrees)
3. Prompt caching optimization
4. Performance profiling integration

**Deliverables:**
- Agent can test changes safely
- Parallel execution for speed
- Optimized for cost and latency

---

## File Structure

```
/Users/manavmht/Documents/HOS/
├── .kiro/
│   ├── memory/                    # Persistent memory
│   │   ├── codebase-map.md        # Architecture overview
│   │   ├── recent-changes.md      # Last 30 days
│   │   ├── conventions.md         # Project patterns
│   │   ├── gotchas.md             # Known pitfalls
│   │   ├── active-tasks.md        # Current WIP
│   │   └── modules/               # Per-module context
│   │       ├── training.md
│   │       ├── nutrition.md
│   │       ├── auth.md
│   │       ├── dashboard.md
│   │       ├── adaptive.md
│   │       └── onboarding.md
│   ├── agent-init.md              # Startup instructions
│   ├── lsp-config.json            # LSP server configuration
│   ├── vector-db/                 # ChromaDB storage
│   ├── knowledge-graph.db         # SQLite knowledge graph
│   └── event-log.jsonl            # Immutable audit trail
├── .git/hooks/
│   ├── pre-commit                 # Security + quality checks
│   └── post-commit                # Auto-update recent-changes.md
└── scripts/
    ├── index-codebase.py          # Build knowledge graph
    ├── generate-embeddings.py     # Create vector embeddings
    └── update-context.py          # Refresh context files
```

---

## Cost & Performance Estimates

### Storage
- Vector DB: ~500MB for 10K code chunks
- Knowledge graph: ~50MB for full codebase
- Event log: ~10MB per month
- **Total:** ~600MB

### Latency
- Code search: <10ms (knowledge graph) or <100ms (vector search)
- LSP queries: <50ms (go-to-def, find-refs)
- Memory retrieval: <20ms (Redis) or <100ms (vector DB)
- Full context load: <2 seconds on agent startup

### API Costs (if using VoyageCode3)
- Embedding generation: $0.10 per 1M tokens
- Full codebase (~500K LOC): ~$5 one-time
- Incremental updates: ~$0.50/month
- **Alternative:** Self-host Nomic Embed Code (free, open-source)

---

## Success Metrics

**Before (Current State):**
- 10-15 min to locate relevant files
- 30+ min to understand module architecture
- Context loss between sessions
- Manual test writing
- Reactive security (find issues after commit)

**After (With Full System):**
- <1 min to locate any file (knowledge graph)
- <5 min to understand any module (context files + RAG)
- Zero context loss (persistent memory)
- Automated test generation
- Proactive security (block issues before commit)

**Expected productivity gain: 5-10x**

---

## Next Steps

**Immediate (This Week):**
1. Create file-based memory system (`.kiro/memory/`)
2. Write comprehensive codebase map
3. Document all 6 major modules
4. Set up agent initialization

**Short-term (Next 2 Weeks):**
1. Implement RAG pipeline with Nomic Embed Code
2. Build knowledge graph with CodeGraphContext
3. Integrate LSP (tsserver + Pyright)

**Medium-term (Next Month):**
1. Automated testing workflows
2. Security scanning integration
3. Shadow workspace for safe experimentation

**Long-term (Next 2-3 Months):**
1. Multi-agent parallelism
2. Advanced prompt caching
3. Self-improving agent (learns from mistakes)

---

## Shall I Start Implementation?

**I can begin with Phase 1 (Foundation) right now:**
1. Create complete `.kiro/memory/` structure
2. Write comprehensive codebase map
3. Document all 6 modules in detail
4. Set up agent initialization
5. Create git hooks for auto-updates

**Estimated time:** 2-3 hours for complete foundation

**This will immediately give you:**
- Zero context loss between sessions
- Instant file location
- Full architecture understanding
- Documented patterns and gotchas

**Ready to build this?**


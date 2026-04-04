"""
Repwise Codebase Indexer - Creates vector embeddings for semantic search

Usage:
    python scripts/index_codebase.py

This script:
1. Parses all TypeScript and Python files
2. Chunks code at function/class boundaries
3. Generates embeddings using sentence-transformers
4. Stores in ChromaDB for semantic search
"""

import os
from pathlib import Path
import chromadb
from chromadb.utils import embedding_functions

# Initialize ChromaDB
client = chromadb.PersistentClient(path=".kiro/vector-db")

# Use sentence-transformers (open-source, no API key needed)
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"  # Fast, good for code
)

collection = client.get_or_create_collection(
    name="repwise_code",
    embedding_function=embedding_fn,
    metadata={"description": "Repwise codebase embeddings"}
)

def chunk_file(file_path: str, content: str) -> list:
    """Simple line-based chunking (500 lines with 50 line overlap)"""
    lines = content.split('\n')
    chunks = []
    chunk_size = 500
    overlap = 50
    
    for i in range(0, len(lines), chunk_size - overlap):
        chunk_lines = lines[i:i + chunk_size]
        if len(chunk_lines) < 10:  # Skip tiny chunks
            continue
        
        chunks.append({
            'code': '\n'.join(chunk_lines),
            'file': file_path,
            'line_start': i + 1,
            'line_end': i + len(chunk_lines),
        })
    
    return chunks

def index_codebase():
    """Index all TypeScript and Python files"""
    base_path = Path(".")
    
    # Find all code files
    ts_files = list(base_path.glob("app/**/*.ts")) + list(base_path.glob("app/**/*.tsx"))
    py_files = list(base_path.glob("src/**/*.py"))
    
    all_files = ts_files + py_files
    print(f"Found {len(all_files)} files to index")
    
    documents = []
    metadatas = []
    ids = []
    
    for file_path in all_files:
        try:
            content = file_path.read_text()
            chunks = chunk_file(str(file_path), content)
            
            for chunk in chunks:
                documents.append(chunk['code'])
                metadatas.append({
                    'file': chunk['file'],
                    'line_start': chunk['line_start'],
                    'line_end': chunk['line_end'],
                    'language': 'typescript' if file_path.suffix in ['.ts', '.tsx'] else 'python'
                })
                ids.append(f"{chunk['file']}:{chunk['line_start']}")
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
    
    print(f"Generated {len(documents)} chunks")
    
    # Add to ChromaDB in batches
    batch_size = 100
    for i in range(0, len(documents), batch_size):
        batch_docs = documents[i:i+batch_size]
        batch_meta = metadatas[i:i+batch_size]
        batch_ids = ids[i:i+batch_size]
        
        collection.add(
            documents=batch_docs,
            metadatas=batch_meta,
            ids=batch_ids
        )
        print(f"Indexed {i+len(batch_docs)}/{len(documents)} chunks")
    
    print(f"\n✅ Indexing complete!")
    print(f"   Total chunks: {len(documents)}")
    print(f"   Storage: .kiro/vector-db/")

if __name__ == "__main__":
    index_codebase()

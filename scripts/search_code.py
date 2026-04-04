"""
Semantic Code Search for Repwise

Usage:
    python scripts/search_code.py "rest timer auto start"
"""

import sys
import chromadb
from chromadb.utils import embedding_functions

def search_code(query: str, top_k: int = 5):
    """Search codebase semantically"""
    client = chromadb.PersistentClient(path=".kiro/vector-db")
    
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    
    collection = client.get_collection(
        name="repwise_code",
        embedding_function=embedding_fn
    )
    
    results = collection.query(
        query_texts=[query],
        n_results=top_k
    )
    
    print(f"\n🔍 Search: '{query}'\n")
    print(f"Found {len(results['documents'][0])} results:\n")
    
    for i, (doc, meta) in enumerate(zip(results['documents'][0], results['metadatas'][0])):
        print(f"{i+1}. {meta['file']} (lines {meta['line_start']}-{meta['line_end']})")
        print(f"   Language: {meta['language']}")
        print(f"   Preview: {doc[:200]}...")
        print()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/search_code.py 'your search query'")
        sys.exit(1)
    
    query = " ".join(sys.argv[1:])
    search_code(query)

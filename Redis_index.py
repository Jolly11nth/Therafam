import os
import redis
import numpy as np
from openai import OpenAI
from redis.commands.search.field import TextField, VectorField
from redis.commands.search.index_definition import IndexDefinition, IndexType

# ✅ Connect to Redis Cloud
r = redis.Redis(
    host=os.getenv("REDIS_HOST"),
    port=int(os.getenv("REDIS_PORT")),
    username=os.getenv("REDIS_USERNAME", "default"),
    password=os.getenv("REDIS_PASSWORD"),
    decode_responses=False,
)

# ✅ OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ✅ Define schema for Redis index
schema = (
    TextField("content"),
    VectorField(
        "embedding",
        "HNSW",
        {
            "TYPE": "FLOAT32",
            "DIM": 1536,  # OpenAI embedding size
            "DISTANCE_METRIC": "COSINE", # NOTE: If embedding model changes, DIM must be updated to match
        },
    ),
)

# ✅ Create index (if not exists)
try:
    r.ft("idx:docs").create_index(
        fields=schema,
        definition=IndexDefinition(prefix=["doc:"], index_type=IndexType.HASH),
    )
    print("✅ Redis index created successfully")
except Exception as e:
    print(f"⚠ Index creation skipped: {e}")

# ✅ Load RAG doc
doc_path = "Therafam_CBT_VectorRAG_Personalized_Guide.txt"  # adjust extension if JSON/MD
with open(doc_path, "r", encoding="utf-8") as f:
    text = f.read()

# ✅ Chunk text (avoid hitting token limits)
chunk_size = 800
overlap = 100
chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size - overlap)]

# ✅ Insert chunks into Redis with embeddings
for i, chunk in enumerate(chunks, start=1):
    embedding = client.embeddings.create(
        input=chunk,
        model="text-embedding-3-small"
    ).data[0].embedding

    r.hset(f"doc:{i}", mapping={
        "content": chunk,
        "embedding": np.array(embedding, dtype=np.float32).tobytes()
    })

print(f"✅ Inserted {len(chunks)} chunks from {doc_path} into Redis")

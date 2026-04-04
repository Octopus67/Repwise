"""Export OpenAPI spec from FastAPI app without running the server."""
import json
import sys

sys.path.insert(0, ".")
from src.main import app

spec = app.openapi()
with open("app/types/api/openapi.json", "w") as f:
    json.dump(spec, f, indent=2)
print(f"Exported OpenAPI spec with {len(spec.get('paths', {}))} paths")

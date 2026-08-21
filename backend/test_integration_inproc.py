import os
import sys
sys.path.insert(0, os.path.abspath('backend'))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_full_integration():
    print("=== Testing FastAPI Endpoints In-Memory ===")
    # 1. Root
    r = client.get("/")
    assert r.status_code == 200, r.text
    print("[OK] GET / returned 200:", r.json())

    # 2. Login
    r = client.post("/api/login", json={"username": "teacher1", "password": "secret123"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[OK] POST /api/login returned token for teacher1")

    # 3. /api/me
    r = client.get("/api/me", headers=headers)
    assert r.status_code == 200, r.text
    print("[OK] GET /api/me returned:", r.json()["username"])

    # 4. /api/students
    r = client.get("/api/students", headers=headers)
    assert r.status_code == 200, r.text
    print(f"[OK] GET /api/students returned {len(r.json())} students")

    # 5. /api/system/storage-status
    r = client.get("/api/system/storage-status", headers=headers)
    assert r.status_code == 200, r.text
    print("[OK] GET /api/system/storage-status returned:", r.json()["database"]["engine"])

    # 6. /api/results
    r = client.get("/api/results", headers=headers)
    assert r.status_code == 200, r.text
    print(f"[OK] GET /api/results returned {len(r.json())} evaluations")

    # 7. /api/model-answers
    r = client.get("/api/model-answers", headers=headers)
    assert r.status_code == 200, r.text
    print(f"[OK] GET /api/model-answers returned {len(r.json())} model answers")

    print("\nALL INTEGRATION ENDPOINTS TESTED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_integration()

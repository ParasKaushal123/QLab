from fastapi.testclient import TestClient
from qlab_runner.app import app

client = TestClient(app)

def test_auth_and_project_lifecycle():
    email = f"test_{int(__import__('time').time())}@example.com"
    pw = "Secret123!"
    
    # 1. Signup
    r = client.post("/v1/auth/signup", json={"email": email, "password": pw, "name": "Alice"})
    assert r.status_code == 200, r.text
    data = r.json()
    token = data["token"]
    assert "token" in data
    assert data["user"]["email"] == email
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Duplicate signup fails
    r = client.post("/v1/auth/signup", json={"email": email, "password": pw, "name": "Alice"})
    assert r.status_code == 400

    # 3. Login
    r = client.post("/v1/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200
    assert "token" in r.json()

    # 4. /v1/me
    r = client.get("/v1/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["user"]["name"] == "Alice"

    # 5. Create project
    bell = {"version": "qlab-ir/1", "n": 2, "ops": [{"g": "H", "q": [0]}, {"g": "X", "c": [0], "q": [1]}]}
    r = client.post("/v1/projects", json={"title": "Bell State", "ir": bell}, headers=headers)
    assert r.status_code == 200
    p = r.json()
    proj_id = p["id"]
    assert p["title"] == "Bell State"

    # 6. List projects
    r = client.get("/v1/projects", headers=headers)
    assert r.status_code == 200
    projs = r.json()
    assert len(projs) >= 1
    assert any(x["id"] == proj_id for x in projs)

    # 7. Save version
    bell_mod = {"version": "qlab-ir/1", "n": 2, "ops": [{"g": "H", "q": [0]}, {"g": "X", "c": [0], "q": [1]}, {"g": "Z", "q": [0]}]}
    r = client.post(f"/v1/projects/{proj_id}/versions", json={"ir": bell_mod, "note": "Added Z gate"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["note"] == "Added Z gate"

    # 8. List versions
    r = client.get(f"/v1/projects/{proj_id}/versions", headers=headers)
    assert r.status_code == 200
    vers = r.json()
    assert len(vers) == 2

    # 9. Create share link
    r = client.post("/v1/share", json={"project_id": proj_id}, headers=headers)
    assert r.status_code == 200
    share_token = r.json()["token"]

    # 10. Access share link anonymously (no auth header)
    r = client.get(f"/v1/share/{share_token}")
    assert r.status_code == 200
    shared = r.json()
    assert shared["title"] == "Bell State"
    assert "ir" in shared

    # 11. Learning progress save and get
    r = client.put("/v1/progress", json={"ch2": {"lesson1": "completed"}}, headers=headers)
    assert r.status_code == 200
    r = client.get("/v1/progress", headers=headers)
    assert r.status_code == 200
    assert r.json()["ch2"]["lesson1"] == "completed"

    # 12. Delete project
    r = client.delete(f"/v1/projects/{proj_id}", headers=headers)
    assert r.status_code == 200

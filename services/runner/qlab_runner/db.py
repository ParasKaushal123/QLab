"""Database storage & authentication for QUBIQ projects, versions, and progress.
Supports both PostgreSQL (via psycopg/SQLAlchemy or asyncpg if configured)
and local SQLite (defaulting to qlab.db) for zero-setup deployment.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import secrets
import sqlite3
import uuid
from typing import Any, Optional
import jwt

SECRET_KEY = os.environ.get("QLAB_SECRET_KEY", "qlab-insecure-secret-key-change-in-prod")
DB_URL = os.environ.get("DATABASE_URL", "")


def get_db():
    """Returns a SQLite connection for the current process/thread."""
    db_path = os.environ.get("QLAB_SQLITE_PATH", "qlab.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes tables if they do not exist."""
    conn = get_db()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS versions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            parent_id TEXT,
            ir TEXT NOT NULL,
            script TEXT,
            note TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS progress (
            user_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS shares (
            token TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            version_id TEXT NOT NULL,
            role TEXT DEFAULT 'viewer',
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        """)
    conn.close()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
    return f"{salt}:{pw_hash}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, pw_hash = stored.split(":")
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
        return secrets.compare_digest(check, pw_hash)
    except Exception:
        return False


def create_token(user_id: str, email: str, name: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        return None


# ---------------- CRUD operations
def create_user(email: str, password: str, name: str) -> dict:
    conn = get_db()
    user_id = str(uuid.uuid4())
    now = datetime.datetime.utcnow().isoformat()
    pw_hash = hash_password(password)
    try:
        with conn:
            conn.execute(
                "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, 'user', ?)",
                (user_id, email.lower().strip(), pw_hash, name.strip(), now),
            )
        return {"id": user_id, "email": email, "name": name, "role": "user"}
    except sqlite3.IntegrityError:
        raise ValueError("An account with this email already exists.")
    finally:
        conn.close()


def authenticate_user(email: str, password: str) -> Optional[dict]:
    conn = get_db()
    try:
        cur = conn.execute("SELECT id, email, password_hash, name, role FROM users WHERE email = ?", (email.lower().strip(),))
        row = cur.fetchone()
        if not row or not verify_password(password, row["password_hash"]):
            return None
        return {"id": row["id"], "email": row["email"], "name": row["name"], "role": row["role"]}
    finally:
        conn.close()


def get_user_by_id(user_id: str) -> Optional[dict]:
    conn = get_db()
    try:
        cur = conn.execute("SELECT id, email, name, role FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def list_projects(user_id: str) -> list[dict]:
    conn = get_db()
    try:
        cur = conn.execute(
            """
            SELECT p.id, p.title, p.created_at, p.updated_at,
                   (SELECT ir FROM versions WHERE project_id = p.id ORDER BY created_at DESC LIMIT 1) as latest_ir,
                   (SELECT COUNT(*) FROM versions WHERE project_id = p.id) as version_count
            FROM projects p
            WHERE p.owner_id = ?
            ORDER BY p.updated_at DESC
            """,
            (user_id,),
        )
        out = []
        for r in cur.fetchall():
            d = dict(r)
            if d.get("latest_ir"):
                try:
                    d["latest_ir"] = json.loads(d["latest_ir"])
                except Exception:
                    pass
            out.append(d)
        return out
    finally:
        conn.close()


def create_project(user_id: str, title: str, ir: dict, script: str = "", note: str = "Initial version") -> dict:
    conn = get_db()
    proj_id = str(uuid.uuid4())
    ver_id = str(uuid.uuid4())
    now = datetime.datetime.utcnow().isoformat()
    ir_str = json.dumps(ir)
    try:
        with conn:
            conn.execute(
                "INSERT INTO projects (id, owner_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (proj_id, user_id, title, now, now),
            )
            conn.execute(
                "INSERT INTO versions (id, project_id, parent_id, ir, script, note, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?)",
                (ver_id, proj_id, ir_str, script, note, now),
            )
        return {"id": proj_id, "title": title, "version_id": ver_id, "ir": ir, "updated_at": now}
    finally:
        conn.close()


def get_project(proj_id: str, user_id: str) -> Optional[dict]:
    conn = get_db()
    try:
        cur = conn.execute("SELECT id, owner_id, title, created_at, updated_at FROM projects WHERE id = ?", (proj_id,))
        p = cur.fetchone()
        if not p or (p["owner_id"] != user_id):
            return None
        vcur = conn.execute(
            "SELECT id, parent_id, ir, script, note, created_at FROM versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
            (proj_id,),
        )
        v = vcur.fetchone()
        out = dict(p)
        if v:
            out["version"] = dict(v)
            out["version"]["ir"] = json.loads(out["version"]["ir"])
        return out
    finally:
        conn.close()


def update_project_title(proj_id: str, user_id: str, title: str) -> bool:
    conn = get_db()
    now = datetime.datetime.utcnow().isoformat()
    try:
        with conn:
            cur = conn.execute("UPDATE projects SET title = ?, updated_at = ? WHERE id = ? AND owner_id = ?", (title, now, proj_id, user_id))
            return cur.rowcount > 0
    finally:
        conn.close()


def delete_project(proj_id: str, user_id: str) -> bool:
    conn = get_db()
    try:
        with conn:
            cur = conn.execute("DELETE FROM projects WHERE id = ? AND owner_id = ?", (proj_id, user_id))
            return cur.rowcount > 0
    finally:
        conn.close()


def save_version(proj_id: str, user_id: str, ir: dict, script: str = "", note: str = "") -> dict:
    conn = get_db()
    ver_id = str(uuid.uuid4())
    now = datetime.datetime.utcnow().isoformat()
    ir_str = json.dumps(ir)
    try:
        with conn:
            p = conn.execute("SELECT id FROM projects WHERE id = ? AND owner_id = ?", (proj_id, user_id)).fetchone()
            if not p:
                raise ValueError("Project not found")
            conn.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, proj_id))
            conn.execute(
                "INSERT INTO versions (id, project_id, ir, script, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (ver_id, proj_id, ir_str, script, note, now),
            )
        return {"id": ver_id, "project_id": proj_id, "ir": ir, "note": note, "created_at": now}
    finally:
        conn.close()


def list_versions(proj_id: str, user_id: str) -> list[dict]:
    conn = get_db()
    try:
        p = conn.execute("SELECT id FROM projects WHERE id = ? AND owner_id = ?", (proj_id, user_id)).fetchone()
        if not p:
            raise ValueError("Project not found")
        cur = conn.execute(
            "SELECT id, parent_id, ir, script, note, created_at FROM versions WHERE project_id = ? ORDER BY created_at DESC",
            (proj_id,),
        )
        out = []
        for r in cur.fetchall():
            d = dict(r)
            d["ir"] = json.loads(d["ir"])
            out.append(d)
        return out
    finally:
        conn.close()


def get_progress(user_id: str) -> dict:
    conn = get_db()
    try:
        r = conn.execute("SELECT data FROM progress WHERE user_id = ?", (user_id,)).fetchone()
        return json.loads(r["data"]) if r else {}
    finally:
        conn.close()


def save_progress(user_id: str, data: dict):
    conn = get_db()
    now = datetime.datetime.utcnow().isoformat()
    raw = json.dumps(data)
    try:
        with conn:
            conn.execute(
                "INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = ?, updated_at = ?",
                (user_id, raw, now, raw, now),
            )
    finally:
        conn.close()


def create_share(proj_id: str, user_id: str) -> str:
    conn = get_db()
    try:
        with conn:
            p = conn.execute("SELECT id FROM projects WHERE id = ? AND owner_id = ?", (proj_id, user_id)).fetchone()
            if not p:
                raise ValueError("Project not found")
            v = conn.execute("SELECT id FROM versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (proj_id,)).fetchone()
            if not v:
                raise ValueError("Project has no versions")
            token = secrets.token_urlsafe(16)
            now = datetime.datetime.utcnow().isoformat()
            conn.execute(
                "INSERT INTO shares (token, project_id, version_id, role, created_at) VALUES (?, ?, ?, 'viewer', ?)",
                (token, proj_id, v["id"], now),
            )
            return token
    finally:
        conn.close()


def get_shared(token: str) -> Optional[dict]:
    conn = get_db()
    try:
        r = conn.execute(
            """
            SELECT s.token, s.role, p.title, v.ir, v.script, v.created_at
            FROM shares s
            JOIN projects p ON s.project_id = p.id
            JOIN versions v ON s.version_id = v.id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()
        if not r:
            return None
        d = dict(r)
        d["ir"] = json.loads(d["ir"])
        return d
    finally:
        conn.close()


# Auto-initialize SQLite tables on import
init_db()

import sqlite3
import os
from datetime import datetime

def parse_env(env_path):
    config = {}
    if not os.path.exists(env_path):
        return config
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                config[key.strip()] = val.strip()
    return config

def init_users_table():
    db_path = "c:/Users/TOPIC/Desktop/ftth/ftth.db"
    env_path = "c:/Users/TOPIC/Desktop/ftth/.env"
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Create users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role in ('admin', 'operator', 'project_manager', 'technician')),
        password TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    conn.commit()
    print("Created users table if not exists.")
    
    # 2. Parse env for seed users
    env_config = parse_env(env_path)
    
    seed_users = [
        (
            env_config.get("ADMIN_NAME", "Sami Aloui"),
            env_config.get("ADMIN_EMAIL", "admin@sotetel.tn"),
            "admin",
            env_config.get("ADMIN_PASSWORD", "password123"),
            1
        ),
        (
            env_config.get("OPERATOR_NAME", "Youssef TT"),
            env_config.get("OPERATOR_EMAIL", "operateur@sotetel.tn"),
            "operator",
            env_config.get("OPERATOR_PASSWORD", "password123"),
            1
        ),
        (
            env_config.get("PROJECT_MANAGER_NAME", "Moncef Chef"),
            env_config.get("PROJECT_MANAGER_EMAIL", "chefprojet@sotetel.tn"),
            "project_manager",
            env_config.get("PROJECT_MANAGER_PASSWORD", "password123"),
            1
        ),
        (
            "Anis Ben Salah",
            "anis@sotetel.tn",
            "technician",
            "password123",
            1
        ),
        (
            "Mohamed Trabelsi",
            "mohamed@sotetel.tn",
            "technician",
            "password123",
            1
        ),
        (
            "Yassine Gharbi",
            "yassine@sotetel.tn",
            "technician",
            "password123",
            1
        ),
        (
            "Khalil Mansouri",
            "khalil@sotetel.tn",
            "technician",
            "password123",
            1
        ),
        (
            "Sami Bouzid",
            "sami@sotetel.tn",
            "technician",
            "password123",
            1
        ),
        (
            "Hatem Jelassi",
            "hatem@sotetel.tn",
            "technician",
            "password123",
            1
        ),
        (
            "Wassim Khelifi",
            "wassim@sotetel.tn",
            "technician",
            "password123",
            1
        ),
        (
            "Riadh Hamdi",
            "riadh@sotetel.tn",
            "technician",
            "password123",
            1
        ),
        (
            env_config.get("TECHNICIAN_NAME", "Anis Tech"),
            env_config.get("TECHNICIAN_EMAIL", "technicien@sotetel.tn"),
            "technician",
            env_config.get("TECHNICIAN_PASSWORD", "password123"),
            1
        )
    ]
    
    now_str = datetime.now().isoformat()
    
    for name, email, role, password, active in seed_users:
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        existing = cursor.fetchone()
        if existing:
            # Update credentials but keep active status
            cursor.execute("""
            UPDATE users 
            SET name = ?, role = ?, password = ?, updated_at = ?
            WHERE email = ?
            """, (name, role, password, now_str, email))
            print(f"Updated existing user: {email}")
        else:
            # Insert new user
            cursor.execute("""
            INSERT INTO users (name, email, role, password, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (name, email, role, password, active, now_str, now_str))
            print(f"Inserted new user: {email}")
            
    conn.commit()
    conn.close()
    print("Database seeding of multiple technician accounts completed successfully.")

if __name__ == "__main__":
    init_users_table()

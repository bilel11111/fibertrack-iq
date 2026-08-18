import sqlite3
from datetime import datetime

def init_installations():
    db_path = "c:/Users/TOPIC/Desktop/ftth/ftth.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Create installations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS installations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_name TEXT NOT NULL,
        residence TEXT NOT NULL,
        bloc TEXT,
        appartement TEXT,
        etage TEXT,
        gps TEXT,
        status TEXT NOT NULL CHECK (status IN ('Pending', 'Dispatched', 'Completed', 'Cancelled', 'Fault')),
        assigned_tech TEXT,
        notes TEXT,
        materials_used TEXT, -- JSON-string of materials used e.g. {"CBL-DROP-1F": 120, "CON-SCAPC": 2}
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    conn.commit()
    print("Created installations table if not exists.")
    
    # Seed 3 pending installations if the table is empty
    cursor.execute("SELECT COUNT(*) FROM installations")
    if cursor.fetchone()[0] == 0:
        now_str = datetime.now().isoformat()
        seeded_installations = [
            ("Amine Ben Salem", "Kamélia", "Bloc A", "Appt A.3", "Etage 1", "36.8671,10.2253", "Pending", None, "Nouveau client en attente de raccordement fibre drop.", None, now_str, now_str),
            ("Salma Labidi", "Kamélia", "Bloc B", "Appt B.5", "Etage 2", "36.8672,10.2255", "Pending", None, "Demande urgente d'accès internet Très Haut Débit.", None, now_str, now_str),
            ("Kamel Touati", "Kamélia", "Bloc C", "Appt C.1", "Etage RDC", "36.8670,10.2251", "Pending", None, "Installation standard en rez-de-chaussée.", None, now_str, now_str),
        ]
        
        cursor.executemany("""
        INSERT INTO installations (client_name, residence, bloc, appartement, etage, gps, status, assigned_tech, notes, materials_used, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, seeded_installations)
        conn.commit()
        print("Seeded initial installation requests successfully.")
        
    conn.close()

if __name__ == "__main__":
    init_installations()

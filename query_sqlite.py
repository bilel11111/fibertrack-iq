import sqlite3
import json
import sys
import os

def run_query():
    try:
        # Read request from stdin
        input_data = sys.stdin.read()
        payload = json.loads(input_data)
        
        query = payload.get("sql")
        params = payload.get("params", [])
        
        db_path = "c:/Users/TOPIC/Desktop/ftth/ftth.db"
        if not os.path.exists(db_path):
            print(json.dumps({"error": f"Database file not found at {db_path}"}))
            return
            
        conn = sqlite3.connect(db_path)
        # Configure row factory to return dicts instead of tuples
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(query, params)
        
        if query.strip().upper().startswith("SELECT"):
            rows = cursor.fetchall()
            results = [dict(row) for row in rows]
            print(json.dumps({"data": results}))
        else:
            conn.commit()
            print(json.dumps({"success": True, "changes": conn.total_changes, "last_row_id": cursor.lastrowid}))
            
        conn.close()
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    run_query()

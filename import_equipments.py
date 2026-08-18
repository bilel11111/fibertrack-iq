import sqlite3
import openpyxl
import base64
import sys
import io
import json

def import_equipments():
    try:
        # 1. Read base64 input from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            print(json.dumps({"error": "No Excel data provided."}))
            return
            
        excel_bytes = base64.b64decode(input_data)
        
        # 2. Load openpyxl workbook
        wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
        ws = wb.active
        
        db_path = "c:/Users/TOPIC/Desktop/ftth/ftth.db"
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        olt_added = 0
        fdt_added = 0
        bpi_added = 0
        fdt_updated = 0
        bpi_updated = 0
        
        # 3. Parse rows (look for 'OLT', 'FDT', 'BPI' in the first column)
        for row in ws.iter_rows(values_only=True):
            if not row or len(row) < 2:
                continue
                
            eq_type = str(row[0]).strip().upper() if row[0] else ""
            if eq_type not in ["OLT", "FDT", "BPI"]:
                continue
                
            eq_name = str(row[1]).strip() if row[1] else ""
            eq_parent = str(row[2]).strip() if len(row) > 2 and row[2] else ""
            eq_gps = str(row[3]).strip() if len(row) > 3 and row[3] else ""
            
            if not eq_name or eq_name.lower().startswith("nom"):
                continue  # Skip headers if any
                
            if eq_type == "OLT":
                # Check if OLT Port already exists in connections
                clean_port = eq_name.replace("OLT Port ", "").strip()
                cursor.execute("SELECT COUNT(*) FROM connections WHERE port_olt = ?", (clean_port,))
                exists = cursor.fetchone()[0] > 0
                if not exists:
                    cursor.execute(
                        "INSERT INTO connections (appartement, bloc, port_olt, port_carte_gpon) VALUES ('New OLT', 'M', ?, ?)",
                        (clean_port, eq_parent or "GPON-1")
                    )
                    olt_added += 1
                    
            elif eq_type == "FDT":
                # Check if FDT cabinet already exists
                cursor.execute("SELECT COUNT(*) FROM connections WHERE fdt = ?", (eq_name,))
                exists = cursor.fetchone()[0] > 0
                if not exists:
                    cursor.execute(
                        "INSERT INTO connections (appartement, bloc, fdt, gps_fdt, residence) VALUES ('Cabinet', 'C', ?, ?, ?)",
                        (eq_name, eq_gps or "36.8643276,10.2167956", eq_parent or "SOUKRA")
                    )
                    fdt_added += 1
                else:
                    cursor.execute(
                        "UPDATE connections SET gps_fdt = ?, residence = ? WHERE fdt = ?",
                        (eq_gps or "36.8643276,10.2167956", eq_parent or "SOUKRA", eq_name)
                    )
                    fdt_updated += 1
                    
            elif eq_type == "BPI":
                # Check if BPI/PBO box already exists
                cursor.execute("SELECT COUNT(*) FROM connections WHERE pos_bpi = ?", (eq_name,))
                exists = cursor.fetchone()[0] > 0
                if not exists:
                    cursor.execute(
                        "INSERT INTO connections (appartement, bloc, pos_bpi, gps_bpi, fdt) VALUES ('BPI', 'B', ?, ?, ?)",
                        (eq_name, eq_gps or "36.8671225,10.2253475", eq_parent or "Cabinet")
                    )
                    bpi_added += 1
                else:
                    cursor.execute(
                        "UPDATE connections SET gps_bpi = ?, fdt = ? WHERE pos_bpi = ?",
                        (eq_gps or "36.8671225,10.2253475", eq_parent or "Cabinet", eq_name)
                    )
                    bpi_updated += 1
                    
        conn.commit()
        conn.close()
        
        print(json.dumps({
            "success": True,
            "olt_added": olt_added,
            "fdt_added": fdt_added,
            "bpi_added": bpi_added,
            "fdt_updated": fdt_updated,
            "bpi_updated": bpi_updated
        }))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    import_equipments()

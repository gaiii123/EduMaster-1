"""Quick script to inspect the SQLite database schema and row counts."""
import sqlite3

conn = sqlite3.connect("edumaster.db")
cursor = conn.cursor()

# List all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [t[0] for t in cursor.fetchall()]

print(f"Database: edumaster.db")
print(f"Tables found: {len(tables)}\n")

for table in tables:
    print(f"=== {table} ===")
    cursor.execute(f"PRAGMA table_info({table})")
    cols = cursor.fetchall()
    for col in cols:
        cid, name, col_type, notnull, default, pk = col
        flags = []
        if pk:
            flags.append("PK")
        if notnull:
            flags.append("NOT NULL")
        if default is not None:
            flags.append(f"DEFAULT {default}")
        flag_str = "  ".join(flags) if flags else ""
        print(f"  {name:<30} {col_type:<15} {flag_str}")

    cursor.execute(f"SELECT COUNT(*) FROM {table}")
    count = cursor.fetchone()[0]
    print(f"  -> {count} row(s)\n")

conn.close()

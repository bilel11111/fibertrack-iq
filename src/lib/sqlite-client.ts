export async function sqliteQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const res = await fetch("/api/sqlite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Query failed");
    }
    const payload = await res.json();
    if (payload.error) throw new Error(payload.error);
    return (payload.data || []) as T[];
  } catch (error: any) {
    console.error("SQLite query error:", error);
    throw error;
  }
}

export async function sqliteExecute(sql: string, params: any[] = []): Promise<{ success: boolean; changes: number; last_row_id?: number }> {
  try {
    const res = await fetch("/api/sqlite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Execution failed");
    }
    const payload = await res.json();
    if (payload.error) throw new Error(payload.error);
    return payload;
  } catch (error: any) {
    console.error("SQLite execution error:", error);
    throw error;
  }
}

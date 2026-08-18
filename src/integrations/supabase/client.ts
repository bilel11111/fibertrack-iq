import { sqliteQuery, sqliteExecute } from '@/lib/sqlite-client';

// Mock session and auth state in local storage to bypass Supabase auth
const SESSION_KEY = "ftth_mock_session";

function getLocalSession() {
  if (typeof window === "undefined") return null;
  const s = localStorage.getItem(SESSION_KEY);
  return s ? JSON.parse(s) : null;
}

const authListeners = new Set<(event: string, session: any) => void>();

// Supabase mock client that maps to local SQLite
export const supabase = {
  auth: {
    async getSession() {
      const session = getLocalSession();
      return { data: { session }, error: null };
    },
    async setSession(tokens: any) {
      const session = tokens;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      authListeners.forEach(cb => cb("SIGNED_IN", session));
      return { data: { session }, error: null };
    },
    async signInWithPassword({ email, password }: { email: string; password?: string }) {
      try {
        const users = await sqliteQuery("SELECT * FROM users WHERE email = ?", [email.trim()]);
        if (users.length === 0) {
          return { data: null, error: new Error("Identifiants incorrects. Utilisateur introuvable.") };
        }
        
        const dbUser = users[0];
        
        // Simple password matching
        if (password && dbUser.password !== password) {
          return { data: null, error: new Error("Mot de passe incorrect.") };
        }
        
        // Check active status
        if (!dbUser.active) {
          return { data: null, error: new Error("Ce compte a été suspendu par l'administrateur.") };
        }
        
        const mockUser = {
          id: `usr-${dbUser.id}`,
          email: dbUser.email,
          role: dbUser.role,
          user_metadata: { name: dbUser.name }
        };
        const mockSession = {
          access_token: `mock-jwt-token-${dbUser.id}`,
          user: mockUser,
          expires_at: Math.floor(Date.now() / 1000) + 3600
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
        
        // Notify listeners
        authListeners.forEach(cb => cb("SIGNED_IN", mockSession));
        
        return { data: { user: mockUser, session: mockSession }, error: null };
      } catch (err: any) {
        return { data: null, error: err };
      }
    },
    async signUp({ email }: { email: string }) {
      return { data: { user: { id: "new-user-1", email } }, error: null };
    },
    async signOut() {
      localStorage.removeItem(SESSION_KEY);
      authListeners.forEach(cb => cb("SIGNED_OUT", null));
      return { error: null };
    },
    onAuthStateChange(callback: (event: string, session: any) => void) {
      authListeners.add(callback);
      // Immediately call with current session
      const session = getLocalSession();
      callback(session ? "INITIAL_SESSION" : "SIGNED_OUT", session);
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
            }
          }
        }
      };
    }
  },
  
  from(table: string) {
    let selectFields = "*";
    let orderCol = "";
    let filters: Record<string, any> = {};
    
    const queryBuilder = {
      select(fields = "*") {
        selectFields = fields;
        return this;
      },
      order(col: string) {
        orderCol = col;
        return this;
      },
      eq(col: string, val: any) {
        filters[col] = val;
        return this;
      },
      // Execute standard select queries
      async then(resolve: any) {
        try {
          let sql = `SELECT ${selectFields} FROM ${table}`;
          let params: any[] = [];
          
          if (Object.keys(filters).length > 0) {
            const clauses = Object.keys(filters).map(col => {
              params.push(filters[col]);
              return `${col} = ?`;
            });
            sql += ` WHERE ${clauses.join(" AND ")}`;
          }
          
          if (orderCol) {
            sql += ` ORDER BY ${orderCol}`;
          }
          
          const data = await sqliteQuery(sql, params);
          resolve({ data, error: null });
        } catch (err: any) {
          resolve({ data: null, error: err });
        }
      },
      
      // Handle inserts
      async insert(payload: any) {
        try {
          const records = Array.isArray(payload) ? payload : [payload];
          for (const rec of records) {
            // Handle table-specific defaults
            if (table === "material_usages") {
              if (!rec.scanned_at) {
                rec.scanned_at = new Date().toISOString();
              }
              if (!rec.status) {
                rec.status = "Pending"; // New usages start as Pending
              }
            }

            const keys = Object.keys(rec);
            const values = Object.values(rec);
            const placeholders = keys.map(() => "?").join(",");
            
            let sql = "";
            if (table === "materials" || table === "alerts") {
              sql = `INSERT INTO ${table} (${keys.join(",")}, created_at, updated_at) VALUES (${placeholders}, datetime('now'), datetime('now'))`;
            } else {
              sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${placeholders})`;
            }
            
            await sqliteExecute(sql, values);
            
            // Decr stock automatically ONLY IF status is Approved on insert
            if (table === "material_usages" && rec.material_id && rec.quantity && rec.status === "Approved") {
              await sqliteExecute(
                "UPDATE materials SET stock_qty = stock_qty - ?, updated_at = datetime('now') WHERE id = ?",
                [rec.quantity, rec.material_id]
              );
            }
          }
          return { error: null };
        } catch (err: any) {
          return { error: err };
        }
      }
    };
    
    return queryBuilder;
  }
};

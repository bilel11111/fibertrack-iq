import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "sqlite-api",
        configureServer(server) {
          server.middlewares.use("/api/config", (req, res) => {
            if (req.method === "GET") {
              try {
                const envPath = path.resolve(process.cwd(), ".env");
                const config: Record<string, string> = {};
                if (fs.existsSync(envPath)) {
                  const content = fs.readFileSync(envPath, "utf8");
                  const lines = content.split(/\r?\n/);
                  for (let line of lines) {
                    line = line.trim();
                    if (!line || line.startsWith("#")) continue;
                    const index = line.indexOf("=");
                    if (index !== -1) {
                      const key = line.substring(0, index).trim();
                      const value = line.substring(index + 1).trim();
                      config[key] = value;
                    }
                  }
                }
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(config));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
            } else {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
            }
          });

          server.middlewares.use("/api/sqlite", (req, res) => {
            if (req.method === "POST") {
              let body = "";
              req.on("data", (chunk) => { body += chunk; });
              req.on("end", () => {
                try {
                  const payload = JSON.parse(body);
                  const scriptPath = path.resolve(process.cwd(), "query_sqlite.py");
                  const result = execSync(`py "${scriptPath}"`, {
                    input: JSON.stringify(payload),
                    encoding: "utf8"
                  });
                  res.setHeader("Content-Type", "application/json");
                  res.end(result);
                } catch (e: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: e.message }));
                }
              });
            } else {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
            }
          });

          server.middlewares.use("/api/equipments/export", (req, res) => {
            if (req.method === "GET" || req.method === "POST") {
              try {
                const scriptPath = "c:/Users/TOPIC/Desktop/ftth/export_equipments.py";
                const result = execSync(`py "${scriptPath}"`, { encoding: "utf8" });
                res.setHeader("Content-Disposition", "attachment; filename=FTTH_Equipements.xlsx");
                res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                res.end(Buffer.from(result.trim(), "base64"));
              } catch (e: any) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: e.message }));
              }
            } else {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
            }
          });

          server.middlewares.use("/api/equipments/import", (req, res) => {
            if (req.method === "POST") {
              let body = "";
              req.on("data", (chunk) => { body += chunk; });
              req.on("end", () => {
                try {
                  const payload = JSON.parse(body);
                  const scriptPath = "c:/Users/TOPIC/Desktop/ftth/import_equipments.py";
                  const result = execSync(`py "${scriptPath}"`, {
                    input: payload.fileData,
                    encoding: "utf8"
                  });
                  res.setHeader("Content-Type", "application/json");
                  res.end(result);
                } catch (e: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: e.message }));
                }
              });
            } else {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
            }
          });
        }
      }
    ]
  }
});


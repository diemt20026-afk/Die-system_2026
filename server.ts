import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Body parsing with limits for base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Enable CORS for all incoming API requests (critical for AI Studio preview iframes)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Ensure data directory and DB file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Seed Initial Data structure (empty by default so Cloud Firestore remains the true authority)
const initialDb = {
  dies: [],
  profiles: [],
  logs: [],
  monthlySales: []
};

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf8");
}

function readDb() {
  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return initialDb;
  }
}

function writeDb(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

// API Routes
app.get("/api/dies", (req, res) => {
  const db = readDb();
  res.json(db.dies || []);
});

app.post("/api/dies", (req, res) => {
  const db = readDb();
  const newDie = {
    id: req.body.id || ("die_" + Date.now()),
    ...req.body
  };
  db.dies = db.dies || [];
  db.dies.push(newDie);
  writeDb(db);
  res.json(newDie);
});

app.put("/api/dies/:id", (req, res) => {
  const db = readDb();
  const id = req.params.id;
  db.dies = db.dies || [];
  const idx = db.dies.findIndex((d: any) => d.id === id);
  if (idx !== -1) {
    db.dies[idx] = { ...db.dies[idx], ...req.body };
    writeDb(db);
    res.json(db.dies[idx]);
  } else {
    res.status(404).json({ error: "Die not found" });
  }
});

app.delete("/api/dies/:id", (req, res) => {
  const db = readDb();
  const id = req.params.id;
  db.dies = db.dies || [];
  db.dies = db.dies.filter((d: any) => d.id !== id);
  writeDb(db);
  res.json({ success: true });
});

app.delete("/api/profiles/:dieCode", (req, res) => {
  const db = readDb();
  const dieCode = req.params.dieCode;
  db.profiles = db.profiles || [];
  db.profiles = db.profiles.filter((p: any) => p.dieCode !== dieCode);
  writeDb(db);
  res.json({ success: true });
});

app.get("/api/profiles", (req, res) => {
  const db = readDb();
  res.json(db.profiles || []);
});

app.post("/api/profiles", (req, res) => {
  const db = readDb();
  const { dieCode, profileName, specs, toolLifeKg, updatedAt } = req.body;
  db.profiles = db.profiles || [];
  const idx = db.profiles.findIndex((p: any) => p.dieCode === dieCode);
  if (idx !== -1) {
    db.profiles[idx] = { ...db.profiles[idx], profileName, specs, toolLifeKg, updatedAt };
  } else {
    db.profiles.push({ dieCode, profileName, specs, toolLifeKg, updatedAt });
  }
  // Also update dies matching this dieCode's specifications and toolLifeKg if they exist
  db.dies = db.dies || [];
  db.dies = db.dies.map((d: any) => {
    if (d.dieCode === dieCode) {
      return {
        ...d,
        profileName: profileName || d.profileName,
        toolLifeKg: toolLifeKg || d.toolLifeKg,
        specs: specs || d.specs
      };
    }
    return d;
  });

  writeDb(db);
  res.json({ success: true });
});

app.get("/api/logs", (req, res) => {
  const db = readDb();
  res.json(db.logs || []);
});

app.post("/api/logs", (req, res) => {
  const db = readDb();
  const newLog = {
    id: "log_" + Date.now(),
    ...req.body
  };
  db.logs = db.logs || [];
  db.logs.push(newLog);
  writeDb(db);
  res.json(newLog);
});

app.delete("/api/logs/:id", (req, res) => {
  const db = readDb();
  db.logs = (db.logs || []).filter((l: any) => l.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

app.delete("/api/logs", (req, res) => {
  const db = readDb();
  const { ids } = req.body || {};
  if (Array.isArray(ids) && ids.length > 0) {
    const set = new Set(ids);
    db.logs = (db.logs || []).filter((l: any) => !set.has(l.id));
  } else {
    db.logs = [];
  }
  writeDb(db);
  res.json({ success: true });
});

app.get("/api/monthly-sales", (req, res) => {
  const db = readDb();
  res.json(db.monthlySales || []);
});

app.post("/api/monthly-sales", (req, res) => {
  const db = readDb();
  db.monthlySales = db.monthlySales || [];
  
  const payload = req.body;
  const items = Array.isArray(payload) ? payload : [payload];
  
  items.forEach((item: any) => {
    if (!item.profileName || !item.month) return;
    const existingIdx = db.monthlySales.findIndex(
      (s: any) => s.profileName.trim().toLowerCase() === item.profileName.trim().toLowerCase() && s.month === item.month
    );
    const targetTon = item.targetSalesTon !== undefined 
      ? Number(item.targetSalesTon) 
      : (item.targetSalesKg !== undefined ? Number(item.targetSalesKg) / 1000 : 0);
    const targetKg = item.targetSalesKg !== undefined 
      ? Number(item.targetSalesKg) 
      : Math.round(targetTon * 1000);

    if (existingIdx !== -1) {
      db.monthlySales[existingIdx].targetSalesTon = targetTon;
      db.monthlySales[existingIdx].targetSalesKg = targetKg;
      db.monthlySales[existingIdx].updatedAt = new Date().toISOString();
    } else {
      db.monthlySales.push({
        profileName: item.profileName.trim(),
        month: item.month,
        targetSalesTon: targetTon,
        targetSalesKg: targetKg,
        updatedAt: new Date().toISOString()
      });
    }
  });

  writeDb(db);
  res.json(db.monthlySales);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

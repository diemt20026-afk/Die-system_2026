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

// Seed Initial Data if not present
const initialDb = {
  dies: [
    {
      id: "die_1",
      dieCode: "TA0034",
      dieNumber: "01",
      profileName: "Aluminium Profile H-Section",
      invoiceNo: "INV-2026-001",
      location: "Rack A-02",
      model: "EX-500",
      toolLifeKg: 10000,
      status: "Available",
      currentUsageKg: 3500,
      isInspected: true,
      lastActionTime: "16/7/2026, 08:30:15",
      createdAt: "2026-07-16T08:30:15.000Z",
      specs: {
        t1a: { min: 2.1, max: 2.3 },
        t1b: { min: 2.1, max: 2.3 },
        t2a: { min: 4.8, max: 5.2 },
        t2b: { min: 4.8, max: 5.2 },
        t3: { min: 1.5, max: 1.7 },
        t4: { min: 0.8, max: 1.0 }
      }
    },
    {
      id: "die_2",
      dieCode: "TA0034",
      dieNumber: "02",
      profileName: "Aluminium Profile H-Section",
      invoiceNo: "INV-2026-001",
      location: "Rack A-03",
      model: "EX-500",
      toolLifeKg: 10000,
      status: "Production",
      currentUsageKg: 9150,
      isInspected: false,
      lastActionTime: "15/7/2026, 14:45:00",
      createdAt: "2026-07-16T08:31:00.000Z",
      specs: {
        t1a: { min: 2.1, max: 2.3 },
        t1b: { min: 2.1, max: 2.3 },
        t2a: { min: 4.8, max: 5.2 },
        t2b: { min: 4.8, max: 5.2 },
        t3: { min: 1.5, max: 1.7 },
        t4: { min: 0.8, max: 1.0 }
      }
    },
    {
      id: "die_3",
      dieCode: "TB0112",
      dieNumber: "01",
      profileName: "U-Channel Heavy Frame",
      invoiceNo: "INV-2026-015",
      location: "Rack B-05",
      model: "EX-800",
      toolLifeKg: 15000,
      status: "Maintenance",
      currentUsageKg: 12000,
      isInspected: false,
      lastActionTime: "16/7/2026, 09:12:30",
      createdAt: "2026-07-16T08:32:00.000Z",
      specs: {
        t1a: { min: 3.0, max: 3.2 },
        t1b: { min: 3.0, max: 3.2 },
        t2a: { min: 6.0, max: 6.4 },
        t2b: { min: 6.0, max: 6.4 },
        t3: { min: 2.0, max: 2.2 },
        t4: { min: 1.2, max: 1.4 }
      }
    }
  ],
  profiles: [
    {
      dieCode: "TA0034",
      profileName: "Aluminium Profile H-Section",
      specs: {
        t1a: { min: 2.1, max: 2.3 },
        t1b: { min: 2.1, max: 2.3 },
        t2a: { min: 4.8, max: 5.2 },
        t2b: { min: 4.8, max: 5.2 },
        t3: { min: 1.5, max: 1.7 },
        t4: { min: 0.8, max: 1.0 }
      },
      toolLifeKg: 10000,
      updatedAt: "2026-07-16T08:30:15.000Z"
    },
    {
      dieCode: "TB0112",
      profileName: "U-Channel Heavy Frame",
      specs: {
        t1a: { min: 3.0, max: 3.2 },
        t1b: { min: 3.0, max: 3.2 },
        t2a: { min: 6.0, max: 6.4 },
        t2b: { min: 6.0, max: 6.4 },
        t3: { min: 2.0, max: 2.2 },
        t4: { min: 1.2, max: 1.4 }
      },
      toolLifeKg: 15000,
      updatedAt: "2026-07-16T08:32:00.000Z"
    }
  ],
  logs: [
    {
      id: "log_1",
      dieId: "die_1",
      dieCode: "TA0034",
      dieNumber: "01",
      type: "Inspection",
      detail: "ตรวจสอบผ่าน (Visual & Dimension OK)",
      weight: 0,
      timestamp: "16/7/2026, 08:30:15",
      timestampRaw: "2026-07-16T08:30:15.000Z",
      userId: "init_user",
      inspectionData: { t1a: 2.2, t1b: 2.21, t2a: 5.0, t2b: 4.95, t3: 1.6, t4: 0.9 },
      performedBy: "admin"
    },
    {
      id: "log_2",
      dieId: "die_2",
      dieCode: "TA0034",
      dieNumber: "02",
      type: "Production",
      detail: "ผลิต 1,500 kg",
      weight: 1500,
      timestamp: "15/7/2026, 14:45:00",
      timestampRaw: "2026-07-15T14:45:00.000Z",
      userId: "init_user",
      performedBy: "user"
    }
  ],
  monthlySales: [
    { profileName: "Aluminium Profile H-Section", month: "2026-09", targetSalesKg: 3500 },
    { profileName: "Aluminium Profile H-Section", month: "2026-10", targetSalesKg: 4000 },
    { profileName: "Aluminium Profile H-Section", month: "2026-11", targetSalesKg: 4200 },
    { profileName: "U-Channel Heavy Frame", month: "2026-09", targetSalesKg: 1200 },
    { profileName: "U-Channel Heavy Frame", month: "2026-10", targetSalesKg: 1500 },
    { profileName: "U-Channel Heavy Frame", month: "2026-11", targetSalesKg: 1800 }
  ]
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
    id: "die_" + Date.now(),
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
    const num = Math.max(0, Number(item.targetSalesKg) || 0);
    if (existingIdx !== -1) {
      db.monthlySales[existingIdx].targetSalesKg = num;
      db.monthlySales[existingIdx].updatedAt = new Date().toISOString();
    } else {
      db.monthlySales.push({
        profileName: item.profileName.trim(),
        month: item.month,
        targetSalesKg: num,
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

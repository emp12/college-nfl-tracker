import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: ["https://mishelper.com", "https://www.mishelper.com"],
  })
);

const dataDir = path.join(__dirname, "data");

// diagnostic logging
console.log("📂 Attempting to serve data folder from:", dataDir);
try {
  const files = fs.readdirSync(dataDir);
  console.log("✅ Found data directory with files:", files);
} catch (err) {
  console.error("❌ Could not read data directory:", err.message);
}

// 👉 this is the correct line: data folder is beside server.js
app.use("/data", express.static(dataDir));

app.get("/", (req, res) => {
  res.send("College NFL Tracker backend is running ✅");
});

app.use((req, res) => {
  res.status(404).send(`Route not found: ${req.originalUrl}`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
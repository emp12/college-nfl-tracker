import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ✅ Proper __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ Allow your production frontend
app.use(
  cors({
    origin: ["https://mishelper.com", "https://www.mishelper.com"],
  })
);

// ✅ Figure out where your /data folder is located
const dataDir = path.join(__dirname, "data");

// 🧭 Diagnostic logging — helps confirm Render paths
console.log("📂 Attempting to serve data folder from:", dataDir);

try {
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir);
    console.log("✅ Found data directory with files:", files);
  } else {
    console.log("❌ Data directory does NOT exist at:", dataDir);
  }
} catch (err) {
  console.error("❌ Error reading data directory:", err.message);
}

// ✅ Serve JSON files from the /data folder
app.use("/data", express.static(dataDir));

// ✅ Root health check route
app.get("/", (req, res) => {
  res.send("College NFL Tracker backend is running ✅");
});

// ✅ Catch-all route for 404s (for clarity)
app.use((req, res) => {
  res.status(404).send(`Route not found: ${req.originalUrl}`);
});

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
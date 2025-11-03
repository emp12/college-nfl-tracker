import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// 🧭 Fixes __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ Allow requests from your live frontend
app.use(
  cors({
    origin: ["https://mishelper.com", "https://www.mishelper.com"],
  })
);

// ✅ Log every request (helps confirm Render is serving files)
app.use((req, res, next) => {
  console.log("Incoming request:", req.method, req.url);
  next();
});

// ✅ Serve static JSON files from /data
app.use("/data", express.static(path.join(__dirname, "data")));

// ✅ Simple health check route
app.get("/", (req, res) => {
  res.send("College NFL Tracker backend is running ✅");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
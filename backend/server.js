import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 10000;
const __dirname = path.resolve();

app.get("/data/:file", (req, res) => {
  const filePath = path.join(__dirname, "data", `${req.params.file}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
  res.sendFile(filePath);
});

app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
import express from "express";
import cors from "cors";
import path from "path";

const app = express();

app.use(
  cors({
    origin: ["https://mishelper.com", "https://www.mishelper.com"],
  })
);

// serve the data directory
app.use("/data", express.static(path.join(process.cwd(), "data")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
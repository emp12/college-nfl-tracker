import express from "express";
import cors from "cors";
import path from "path";

const app = express();

// ✅ Allow only your production domain
app.use(
  cors({
    origin: ["https://mishelper.com", "https://www.mishelper.com"],
  })
);

// ✅ Serve your data folder
app.use("/data", express.static("data"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
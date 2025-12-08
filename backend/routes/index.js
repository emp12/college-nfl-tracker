const express = require("express");
const router = express.Router();

const homeRouter = require("./home");
const collegeRouter = require("./college");

router.use("/home", homeRouter);     // → /api/home
router.use("/college", collegeRouter);

module.exports = router;
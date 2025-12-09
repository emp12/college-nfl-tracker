const express = require("express");
const router = express.Router();

router.use("/home", require("./home"));
router.use("/college", require("./college"));
router.use("/positions", require("./positions"));

module.exports = router;
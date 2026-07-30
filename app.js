const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 4000;

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Dashboard route
app.get("/", (req, res) => {
    res.render("dashboard", {
        pageTitle: "MoneyMap Dashboard"
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`MoneyMap is running on http://localhost:${PORT}`);
});
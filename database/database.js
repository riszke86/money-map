const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const databasePath = path.join(__dirname, "moneymap.db");

const db = new sqlite3.Database(databasePath, (error) => {
    if (error) {
        console.error("Database connection failed:", error.message);
        return;
    }

    console.log("Connected to the MoneyMap database.");
});

db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");

    db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL
                CHECK(type IN ('income', 'expense')),
            title TEXT NOT NULL,
            amount REAL NOT NULL
                CHECK(amount > 0),
            category TEXT NOT NULL,
            transaction_date TEXT NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS recurring_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            amount REAL NOT NULL
                CHECK(amount > 0),
            category TEXT NOT NULL,
            frequency TEXT NOT NULL
                CHECK(
                    frequency IN (
                        'weekly',
                        'monthly',
                        'quarterly',
                        'yearly'
                    )
                ),
            next_payment_date TEXT NOT NULL,
            reminder_days INTEGER DEFAULT 7,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

db.run(`
    CREATE TABLE IF NOT EXISTS payment_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recurring_payment_id INTEGER NOT NULL,
        payment_name TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        paid_date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (recurring_payment_id)
            REFERENCES recurring_payments(id)
            ON DELETE CASCADE
    )
`);

    db.run(`
        CREATE TABLE IF NOT EXISTS savings_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            target_amount REAL NOT NULL
                CHECK(target_amount > 0),
            current_amount REAL DEFAULT 0
                CHECK(current_amount >= 0),
            target_date TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL
                CHECK(type IN ('income', 'expense')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, type)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS payment_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recurring_payment_id INTEGER NOT NULL,
            payment_name TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            paid_date TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (recurring_payment_id)
            REFERENCES recurring_payments(id)
            ON DELETE CASCADE
        )
    `);

    const defaultCategories = [
        ["Salary", "income"],
        ["Freelance", "income"],
        ["Benefits", "income"],
        ["Other Income", "income"],

        ["Housing", "expense"],
        ["Rent", "expense"],
        ["Utilities", "expense"],
        ["Water", "expense"],
        ["Electricity", "expense"],
        ["Gas", "expense"],
        ["Internet", "expense"],

        ["Food", "expense"],
        ["Transport", "expense"],
        ["Car", "expense"],
        ["Insurance", "expense"],

        ["Children", "expense"],
        ["Education", "expense"],
        ["David School", "expense"],

        ["Subscriptions", "expense"],
        ["Entertainment", "expense"],
        ["Debt", "expense"],
        ["Health", "expense"],
        ["Other", "expense"]
    ];

    const categoryStatement = db.prepare(`
        INSERT OR IGNORE INTO categories (name, type)
        VALUES (?, ?)
    `);

    defaultCategories.forEach(([name, type]) => {
        categoryStatement.run(name, type);
    });

    categoryStatement.finalize();
});

module.exports = db;
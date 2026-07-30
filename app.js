const express = require("express");
const path = require("path");

const db = require("./database/database");
const transactionsRouter = require("./routes/transactions");

const app = express();

const PORT = process.env.PORT || 4000;

// ================= VIEW ENGINE =================

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ================= MIDDLEWARE =================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ================= DATABASE HELPERS =================

function dbGet(sql, parameters = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, parameters, (error, row) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(row);
        });
    });
}

function dbAll(sql, parameters = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, parameters, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(rows);
        });
    });
}

// ================= TRANSACTIONS =================

app.use("/transactions", transactionsRouter);

// ================= DASHBOARD =================

app.get("/", async (req, res) => {
    try {
        const balanceResult = await dbGet(`
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'income' THEN amount
                            WHEN type = 'expense' THEN -amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS current_balance
            FROM transactions
        `);

        const monthlyTotals = await dbGet(`
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'income' THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS monthly_income,

                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'expense' THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS monthly_expenses
            FROM transactions
            WHERE strftime('%Y-%m', transaction_date)
                = strftime('%Y-%m', 'now', 'localtime')
        `);

        const upcomingPaymentTotal = await dbGet(`
            SELECT
                COALESCE(SUM(amount), 0) AS upcoming_total
            FROM recurring_payments
            WHERE is_active = 1
              AND date(next_payment_date)
                  BETWEEN date('now', 'localtime')
                  AND date('now', 'localtime', '+30 days')
        `);

        const upcomingPayments = await dbAll(`
            SELECT
                id,
                name,
                amount,
                category,
                frequency,
                next_payment_date,
                reminder_days
            FROM recurring_payments
            WHERE is_active = 1
              AND date(next_payment_date)
                  >= date('now', 'localtime')
            ORDER BY date(next_payment_date) ASC
            LIMIT 5
        `);

        const savingsGoals = await dbAll(`
            SELECT
                id,
                name,
                target_amount,
                current_amount,
                target_date
            FROM savings_goals
            ORDER BY created_at DESC
            LIMIT 4
        `);

        const recentTransactions = await dbAll(`
            SELECT
                id,
                type,
                title,
                amount,
                category,
                transaction_date,
                notes
            FROM transactions
            ORDER BY
                date(transaction_date) DESC,
                id DESC
            LIMIT 6
        `);

        const currentBalance =
            Number(balanceResult.current_balance) || 0;

        const monthlyIncome =
            Number(monthlyTotals.monthly_income) || 0;

        const monthlyExpenses =
            Number(monthlyTotals.monthly_expenses) || 0;

        const upcomingTotal =
            Number(upcomingPaymentTotal.upcoming_total) || 0;

        const safeAvailableBalance =
            currentBalance - upcomingTotal;

        res.render("dashboard", {
            pageTitle: "MoneyMap Dashboard",

            currentBalance,
            monthlyIncome,
            monthlyExpenses,
            upcomingTotal,
            safeAvailableBalance,

            upcomingPayments,
            savingsGoals,
            recentTransactions
        });
    } catch (error) {
        console.error(
            "Dashboard data could not be loaded:",
            error.message
        );

        res.status(500).send(
            "The MoneyMap dashboard could not be loaded."
        );
    }
});

// ================= PAYMENTS =================

app.get("/payments", (req, res) => {
    res.render("payments", {
        pageTitle: "Payments | MoneyMap"
    });
});

// ================= SAVINGS =================

app.get("/savings", (req, res) => {
    res.render("savings", {
        pageTitle: "Savings | MoneyMap"
    });
});

// ================= START SERVER =================

app.listen(PORT, () => {
    console.log(
        `MoneyMap is running on http://localhost:${PORT}`
    );
});
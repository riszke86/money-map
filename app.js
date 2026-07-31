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

function dbRun(sql, parameters = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, parameters, function (error) {
            if (error) {
                reject(error);
                return;
            }

            resolve({
                id: this.lastID,
                changes: this.changes
            });
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
                reminder_days,

                CASE
                    WHEN date(next_payment_date)
                        = date('now', 'localtime')
                        THEN 'Today'

                    WHEN date(next_payment_date)
                        = date('now', 'localtime', '+1 day')
                        THEN 'Tomorrow'

                    ELSE
                        'In ' ||
                        CAST(
                            julianday(date(next_payment_date)) -
                            julianday(date('now', 'localtime'))
                            AS INTEGER
                        ) ||
                        ' days'
                END AS due_label

            FROM recurring_payments

            WHERE is_active = 1
                AND date(next_payment_date)
                    >= date('now', 'localtime')

            ORDER BY date(next_payment_date) ASC
            LIMIT 5
        `);

        const weeklyPaymentTotal = await dbGet(`
            SELECT
                COALESCE(SUM(amount), 0) AS weekly_total

            FROM recurring_payments

            WHERE is_active = 1
                AND date(next_payment_date)
                    BETWEEN date('now', 'localtime')
                    AND date('now', 'localtime', '+7 days')
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

        const monthlySpendingTrend = await dbAll(`
            WITH RECURSIVE months (
                month_number,
                month_start
            ) AS (
                SELECT
                    0,
                    date(
                        'now',
                        'localtime',
                        'start of month',
                        '-6 months'
                    )

                UNION ALL

                SELECT
                    month_number + 1,
                    date(month_start, '+1 month')
                FROM months
                WHERE month_number < 6
            )

            SELECT
                strftime('%Y-%m', months.month_start)
                    AS month_key,

                COALESCE(
                    ROUND(
                        SUM(
                            CASE
                                WHEN transactions.type = 'expense'
                                    THEN transactions.amount
                                ELSE 0
                            END
                        ),
                        2
                    ),
                    0
                ) AS total_spending

            FROM months

            LEFT JOIN transactions
                ON strftime(
                    '%Y-%m',
                    transactions.transaction_date
                ) = strftime('%Y-%m', months.month_start)

            GROUP BY months.month_start
            ORDER BY months.month_start ASC
        `);

        const currentBalance =
            Number(balanceResult.current_balance) || 0;

        const monthlyIncome =
            Number(monthlyTotals.monthly_income) || 0;

        const monthlyExpenses =
            Number(monthlyTotals.monthly_expenses) || 0;

        const upcomingTotal =
            Number(upcomingPaymentTotal.upcoming_total) || 0;

        const weeklyDueTotal =
            Number(weeklyPaymentTotal.weekly_total) || 0;

        const safeAvailableBalance =
            currentBalance - upcomingTotal;

        console.log(
            "Monthly spending trend:",
            monthlySpendingTrend
        );

        res.render("dashboard", {
            pageTitle: "MoneyMap Dashboard",

            currentBalance,
            monthlyIncome,
            monthlyExpenses,
            upcomingTotal,
            weeklyDueTotal,
            safeAvailableBalance,

            upcomingPayments,
            savingsGoals,
            recentTransactions,
            monthlySpendingTrend
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

// ================= PAYMENTS =================

app.get("/payments", async (req, res) => {
    try {
        const payments = await dbAll(`
            SELECT
                rp.id,
                rp.name,
                rp.amount,
                rp.category,
                rp.frequency,
                rp.next_payment_date,
                rp.reminder_days,
                rp.is_active,

                CASE
                    WHEN (
                        SELECT COUNT(*)
                        FROM payment_records pr
                        WHERE pr.recurring_payment_id = rp.id
                            AND strftime('%Y-%m', pr.paid_date)
                                = strftime('%Y-%m', 'now', 'localtime')
                    ) > 0
                    THEN 1
                    ELSE 0
                END AS paid_this_month

            FROM recurring_payments rp

            ORDER BY
                rp.is_active DESC,
                date(rp.next_payment_date) ASC,
                rp.name ASC
        `);

        const categories = await dbAll(`
            SELECT name
            FROM categories
            WHERE type = 'expense'
            ORDER BY name ASC
        `);

        const categoryTotals = await dbAll(`
            SELECT
                category,
                ROUND(
                    SUM(
                        CASE
                            WHEN frequency = 'weekly'
                                THEN amount * 52 / 12

                            WHEN frequency = 'monthly'
                                THEN amount

                            WHEN frequency = 'quarterly'
                                THEN amount / 3

                            WHEN frequency = 'yearly'
                                THEN amount / 12

                            ELSE 0
                        END
                    ),
                    2
                ) AS monthly_total
            FROM recurring_payments
            WHERE is_active = 1
            GROUP BY category
            ORDER BY monthly_total DESC
        `);

        const monthlyTotalResult = await dbGet(`
            SELECT
                ROUND(
                    COALESCE(
                        SUM(
                            CASE
                                WHEN frequency = 'weekly'
                                    THEN amount * 52 / 12

                                WHEN frequency = 'monthly'
                                    THEN amount

                                WHEN frequency = 'quarterly'
                                    THEN amount / 3

                                WHEN frequency = 'yearly'
                                    THEN amount / 12

                                ELSE 0
                            END
                        ),
                        0
                    ),
                    2
                ) AS monthly_total
            FROM recurring_payments
            WHERE is_active = 1
        `);

        const yearlyTotalResult = await dbGet(`
            SELECT
                ROUND(
                    COALESCE(
                        SUM(
                            CASE
                                WHEN frequency = 'weekly'
                                    THEN amount * 52

                                WHEN frequency = 'monthly'
                                    THEN amount * 12

                                WHEN frequency = 'quarterly'
                                    THEN amount * 4

                                WHEN frequency = 'yearly'
                                    THEN amount

                                ELSE 0
                            END
                        ),
                        0
                    ),
                    2
                ) AS yearly_total
            FROM recurring_payments
            WHERE is_active = 1
        `);

        res.render("payments", {
            pageTitle: "Payments | MoneyMap",
            payments,
            categories,
            categoryTotals,
            monthlyTotal:
                Number(monthlyTotalResult.monthly_total) || 0,
            yearlyTotal:
                Number(yearlyTotalResult.yearly_total) || 0,
            paymentAdded: req.query.added === "true",
            paymentDeleted: req.query.deleted === "true",
            paymentUpdated: req.query.updated === "true",
            paymentPaid: req.query.paid === "true",
            formError: null,
            formData: {}
        });
    } catch (error) {
        console.error(
            "Payments could not be loaded:",
            error.message
        );

        res.status(500).send(
            "The recurring payments page could not be loaded."
        );
    }
});

app.post("/payments", async (req, res) => {
    const {
        name,
        amount,
        category,
        frequency,
        nextPaymentDate,
        reminderDays
    } = req.body;

    const cleanName = String(name || "").trim();
    const cleanCategory = String(category || "").trim();
    const cleanFrequency = String(frequency || "").trim();
    const numericAmount = Number(amount);
    const numericReminderDays =
        Number(reminderDays) || 0;

    const allowedFrequencies = [
        "weekly",
        "monthly",
        "quarterly",
        "yearly"
    ];

    if (
        !cleanName ||
        !cleanCategory ||
        !nextPaymentDate ||
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0 ||
        !allowedFrequencies.includes(cleanFrequency)
    ) {
        try {
            const payments = await dbAll(`
                SELECT *
                FROM recurring_payments
                ORDER BY
                    is_active DESC,
                    date(next_payment_date) ASC
            `);

            const categories = await dbAll(`
                SELECT name
                FROM categories
                WHERE type = 'expense'
                ORDER BY name ASC
            `);

            const categoryTotals = await dbAll(`
                SELECT
                    category,
                    ROUND(
                        SUM(
                            CASE
                                WHEN frequency = 'weekly'
                                    THEN amount * 52 / 12
                                WHEN frequency = 'monthly'
                                    THEN amount
                                WHEN frequency = 'quarterly'
                                    THEN amount / 3
                                WHEN frequency = 'yearly'
                                    THEN amount / 12
                                ELSE 0
                            END
                        ),
                        2
                    ) AS monthly_total
                FROM recurring_payments
                WHERE is_active = 1
                GROUP BY category
                ORDER BY monthly_total DESC
            `);

            res.status(400).render("payments", {
                pageTitle: "Payments | MoneyMap",
                payments,
                categories,
                categoryTotals,
                monthlyTotal: 0,
                yearlyTotal: 0,
                paymentAdded: false,
                paymentDeleted: false,
                paymentUpdated: false,
                paymentPaid: false,
                formError:
                    "Please complete all required fields correctly.",
                formData: req.body
            });
        } catch (error) {
            res.status(500).send(
                "The payment could not be added."
            );
        }

        return;
    }

    try {
        await dbRun(`
            INSERT INTO recurring_payments (
                name,
                amount,
                category,
                frequency,
                next_payment_date,
                reminder_days,
                is_active
            )
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `, [
            cleanName,
            numericAmount,
            cleanCategory,
            cleanFrequency,
            nextPaymentDate,
            numericReminderDays
        ]);

        res.redirect("/payments?added=true");
    } catch (error) {
        console.error(
            "Payment could not be added:",
            error.message
        );

        res.status(500).send(
            "The recurring payment could not be added."
        );
    }
});

app.post("/payments/:id/toggle", async (req, res) => {
    const paymentId = Number(req.params.id);

    if (!Number.isInteger(paymentId)) {
        return res.status(400).send(
            "Invalid payment ID."
        );
    }

    try {
        await dbRun(`
            UPDATE recurring_payments
            SET is_active =
                CASE
                    WHEN is_active = 1 THEN 0
                    ELSE 1
                END
            WHERE id = ?
        `, [paymentId]);

        res.redirect("/payments?updated=true");
    } catch (error) {
        console.error(
            "Payment status could not be updated:",
            error.message
        );

        res.status(500).send(
            "The payment status could not be updated."
        );
    }
});

app.post("/payments/:id/paid", async (req, res) => {
    const paymentId = Number(req.params.id);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
        return res.status(400).send(
            "Invalid payment ID."
        );
    }

    try {
        const payment = await dbGet(`
            SELECT
                id,
                name,
                amount,
                category,
                frequency,
                next_payment_date,
                is_active
            FROM recurring_payments
            WHERE id = ?
        `, [paymentId]);

        if (!payment) {
            return res.status(404).send(
                "Recurring payment not found."
            );
        }

        if (payment.is_active !== 1) {
            return res.status(400).send(
                "A paused payment cannot be marked as paid."
            );
        }

        const existingPaymentRecord = await dbGet(`
            SELECT id
            FROM payment_records
            WHERE recurring_payment_id = ?
                AND strftime('%Y-%m', paid_date)
                    = strftime('%Y-%m', 'now', 'localtime')
        `, [paymentId]);

        if (existingPaymentRecord) {
            return res.redirect("/payments?paid=true");
        }

        await dbRun("BEGIN TRANSACTION");

        try {
            await dbRun(`
                INSERT INTO transactions (
                    type,
                    title,
                    amount,
                    category,
                    transaction_date,
                    notes
                )
                VALUES (
                    'expense',
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
            `, [
                payment.name,
                payment.amount,
                payment.category,
                new Date().toISOString().slice(0, 10),
                `Automatically recorded from recurring payment #${payment.id}`
            ]);

            await dbRun(`
                INSERT INTO payment_records (
                    recurring_payment_id,
                    payment_name,
                    amount,
                    category,
                    paid_date
                )
                VALUES (?, ?, ?, ?, ?)
            `, [
                payment.id,
                payment.name,
                payment.amount,
                payment.category,
                new Date().toISOString().slice(0, 10)
            ]);

            await dbRun(`
                UPDATE recurring_payments
                SET next_payment_date =
                    CASE frequency
                        WHEN 'weekly'
                            THEN date(next_payment_date, '+7 days')

                        WHEN 'monthly'
                            THEN date(next_payment_date, '+1 month')

                        WHEN 'quarterly'
                            THEN date(next_payment_date, '+3 months')

                        WHEN 'yearly'
                            THEN date(next_payment_date, '+1 year')

                        ELSE next_payment_date
                    END
                WHERE id = ?
            `, [paymentId]);

            await dbRun("COMMIT");
        } catch (transactionError) {
            await dbRun("ROLLBACK");
            throw transactionError;
        }

        res.redirect("/payments?paid=true");
    } catch (error) {
        console.error(
            "Payment could not be marked as paid:",
            error.message
        );

        res.status(500).send(
            "The recurring payment could not be recorded."
        );
    }
});

app.post("/payments/:id/delete", async (req, res) => {
    const paymentId = Number(req.params.id);

    if (!Number.isInteger(paymentId)) {
        return res.status(400).send(
            "Invalid payment ID."
        );
    }

    try {
        await dbRun(`
            DELETE FROM recurring_payments
            WHERE id = ?
        `, [paymentId]);

        res.redirect("/payments?deleted=true");
    } catch (error) {
        console.error(
            "Payment could not be deleted:",
            error.message
        );

        res.status(500).send(
            "The recurring payment could not be deleted."
        );
    }
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
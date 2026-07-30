const express = require("express");
const router = express.Router();

const db = require("../database/database");

// ========================
// GET TRANSACTIONS PAGE
// ========================

router.get("/", (req, res) => {
    const transactionsQuery = `
        SELECT
            id,
            type,
            title,
            amount,
            category,
            transaction_date,
            notes
        FROM transactions
        ORDER BY transaction_date DESC, id DESC
    `;

    const categoriesQuery = `
        SELECT id, name, type
        FROM categories
        ORDER BY type, name
    `;

    const summaryQuery = `
        SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN type = 'income'
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS total_income,

            COALESCE(
                SUM(
                    CASE
                        WHEN type = 'expense'
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS total_expenses

        FROM transactions
    `;

    db.all(transactionsQuery, [], (transactionsError, transactions) => {
        if (transactionsError) {
            console.error(
                "Could not load transactions:",
                transactionsError.message
            );

            return res.status(500).send(
                "Unable to load transactions."
            );
        }

        db.all(categoriesQuery, [], (categoriesError, categories) => {
            if (categoriesError) {
                console.error(
                    "Could not load categories:",
                    categoriesError.message
                );

                return res.status(500).send(
                    "Unable to load categories."
                );
            }

            db.get(summaryQuery, [], (summaryError, summaryRow) => {
                if (summaryError) {
                    console.error(
                        "Could not calculate transaction summary:",
                        summaryError.message
                    );

                    return res.status(500).send(
                        "Unable to calculate transaction totals."
                    );
                }

                const totalIncome =
                    Number(summaryRow.total_income) || 0;

                const totalExpenses =
                    Number(summaryRow.total_expenses) || 0;

                res.render("transactions", {
                    pageTitle: "Transactions | MoneyMap",
                    transactions,
                    categories,
                    summary: {
                        totalIncome,
                        totalExpenses,
                        balance: totalIncome - totalExpenses
                    },
                    successMessage:
                        req.query.success === "true"
                            ? "Transaction added successfully."
                            : null,
                    deletedMessage:
                        req.query.deleted === "true"
                            ? "Transaction deleted successfully."
                            : null,
                    errorMessage:
                        req.query.error === "true"
                            ? "The transaction could not be saved."
                            : null
                });
            });
        });
    });
});

// ========================
// ADD TRANSACTION
// ========================

router.post("/", (req, res) => {
    const {
        type,
        title,
        amount,
        category,
        transactionDate,
        notes
    } = req.body;

    const validTypes = ["income", "expense"];
    const numericAmount = Number(amount);

    if (
        !validTypes.includes(type) ||
        !title ||
        !category ||
        !transactionDate ||
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
    ) {
        return res.redirect("/transactions?error=true");
    }

    const insertQuery = `
        INSERT INTO transactions (
            type,
            title,
            amount,
            category,
            transaction_date,
            notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
        type,
        title.trim(),
        numericAmount,
        category,
        transactionDate,
        notes ? notes.trim() : null
    ];

    db.run(insertQuery, values, function (error) {
        if (error) {
            console.error(
                "Could not add transaction:",
                error.message
            );

            return res.redirect("/transactions?error=true");
        }

        res.redirect("/transactions?success=true");
    });
});

// ========================
// DELETE TRANSACTION
// ========================

router.post("/:id/delete", (req, res) => {
    const transactionId = Number(req.params.id);

    if (!Number.isInteger(transactionId)) {
        return res.redirect("/transactions?error=true");
    }

    const deleteQuery = `
        DELETE FROM transactions
        WHERE id = ?
    `;

    db.run(deleteQuery, [transactionId], function (error) {
        if (error) {
            console.error(
                "Could not delete transaction:",
                error.message
            );

            return res.redirect("/transactions?error=true");
        }

        res.redirect("/transactions?deleted=true");
    });
});

module.exports = router;
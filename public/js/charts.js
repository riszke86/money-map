document.addEventListener("DOMContentLoaded", () => {
    const chartCanvas =
        document.getElementById("monthlySpendingChart");

    if (
        !chartCanvas ||
        typeof Chart === "undefined"
    ) {
        return;
    }

    const rawData = decodeURIComponent(
        chartCanvas.dataset.spending || "%5B%5D"
    );

    let spendingData = [];

    try {
        spendingData = JSON.parse(rawData);
    } catch (error) {
        console.error(
            "Monthly spending chart data could not be read:",
            error
        );

        return;
    }

    new Chart(chartCanvas, {
        type: "bar",

        data: {
            labels: spendingData.map(
                item => item.month
            ),

            datasets: [
                {
                    label: "Monthly spending",

                    data: spendingData.map(
                        item => item.amount
                    ),

                    backgroundColor:
                        "rgba(100, 27, 48, 0.84)",

                    hoverBackgroundColor:
                        "rgba(100, 27, 48, 1)",

                    borderRadius: 10,
                    borderSkipped: false,
                    maxBarThickness: 58
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                x: {
                    grid: {
                        display: false
                    },

                    border: {
                        display: false
                    }
                },

                y: {
                    beginAtZero: true,

                    border: {
                        display: false
                    },

                    grid: {
                        color:
                            "rgba(110, 38, 57, 0.08)"
                    },

                    ticks: {
                        callback(value) {
                            return `£${value}`;
                        }
                    }
                }
            },

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        label(context) {
                            const value =
                                Number(context.raw) || 0;

                            return value.toLocaleString(
                                "en-GB",
                                {
                                    style: "currency",
                                    currency: "GBP"
                                }
                            );
                        }
                    }
                }
            }
        }
    });
});
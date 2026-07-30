# MoneyMap

MoneyMap is a modern personal finance web application built with Node.js, Express, EJS and SQLite.

The application allows users to track income and expenses, manage recurring payments, monitor savings goals and view a financial dashboard that provides an overview of their finances.

---

## Features

- Dashboard with financial overview
- Add income and expense transactions
- Manage recurring payments
- Track savings goals
- SQLite database
- Responsive design
- Clean modern user interface

---

## Technologies

- Node.js
- Express.js
- EJS
- SQLite
- HTML5
- CSS3
- JavaScript

---

## Installation

Clone the repository:

```bash
git clone https://github.com/riszke86/MoneyMap.git
```

Install dependencies:

```bash
npm install
```

Start the application:

```bash
npm start
```

or

```bash
node app.js
```

Open:

```
http://localhost:4000
```

---

## Database

The SQLite database file is intentionally excluded from this repository.

When the application starts for the first time, the required database tables are created automatically.

This prevents personal financial information from being stored in the repository.

---

## Project Structure

```
MoneyMap
│
├── database/
├── public/
│   ├── css/
│   ├── js/
│   └── images/
│
├── routes/
├── views/
│   ├── partials/
│   └── dashboard.ejs
│
├── app.js
└── package.json
```

---

## Future Improvements

- Authentication and user accounts
- Charts and spending analytics
- Budget planning
- CSV import/export
- Multi-currency support
- Dark mode

---

## Author

Created by **Irisz Marcsik**

Computer Science student at Solent University.

GitHub:
https://github.com/riszke86
# FairShare — Debt Simplification & Group Expense Tracker

Full 3-tier DBMS project: PostgreSQL · Node.js/Express · React/Tailwind

## Features
- **Create Users** — full_name, username, email with validation
- **Create Groups** — auto-adds creator as member
- **Add Members** — multi-select users into groups
- **Add Expense** — ACID transaction, equal/exact split, live preview
- **Settlement Dashboard** — Minimum Cash Flow algorithm, net balances

## Quick Start

```bash
# 1. Database
createdb debttracker
psql -d debttracker -f database/schema.sql

# 2. Backend
cd backend
cp .env.example .env      # fill in your DB credentials
npm install
npm run dev               # → http://localhost:4000

# 3. Frontend
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev               # → http://localhost:3000
```

## Project Structure

```
debt-tracker/
├── database/
│   └── schema.sql                      # Tables, triggers, views, indexes
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── db/pool.js
│   ├── controllers/
│   │   ├── userController.js           # GET/POST /api/users
│   │   ├── groupController.js          # groups + members
│   │   └── expenseController.js        # expenses + settlements
│   ├── services/debtSimplification.js  # Minimum Cash Flow
│   ├── utils/money.js
│   └── routes/api.js
└── frontend/
    └── src/
        ├── api.js                      # central fetch wrapper
        ├── App.jsx                     # shell + tab nav + global state
        └── components/
            ├── ui.jsx                  # design system primitives
            ├── CreateUser.jsx
            ├── CreateGroup.jsx
            ├── AddExpense.jsx
            └── SettlementDashboard.jsx
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/users | List all users |
| POST   | /api/users | Create user |
| GET    | /api/groups | List all groups |
| POST   | /api/groups | Create group (auto-adds creator) |
| GET    | /api/groups/:id/members | List group members |
| POST   | /api/groups/:id/members | Add members |
| GET    | /api/groups/:id/balances | Net balances |
| GET    | /api/groups/:id/settlements | Minimum cash flow |
| POST   | /api/expenses | Add expense (ACID transaction) |

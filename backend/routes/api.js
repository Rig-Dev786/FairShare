const express       = require('express');
const router        = express.Router();
const expenseCtrl   = require('../controllers/expenseController');
const userCtrl      = require('../controllers/userController');
const groupCtrl     = require('../controllers/groupController');

// ── User routes ──────────────────────────────────────────────
router.get('/users',                          userCtrl.listUsers);
router.post('/users',                         userCtrl.createUser);

// ── Group routes ─────────────────────────────────────────────
router.get('/groups',                         groupCtrl.listGroups);
router.post('/groups',                        groupCtrl.createGroup);
router.get('/groups/:groupId/members',        groupCtrl.getGroupMembers);
router.post('/groups/:groupId/members',       groupCtrl.addMembers);
router.get('/groups/:groupId/balances',       expenseCtrl.getGroupBalances);
router.get('/groups/:groupId/settlements',    expenseCtrl.getSettlements);
router.get('/groups/:groupId/expenses/food',  expenseCtrl.getFoodExpenses);

// ── Expense routes ────────────────────────────────────────────
router.post('/expenses',                      expenseCtrl.createExpense);

module.exports = router;

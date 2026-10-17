<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Bill;
use App\Models\Debt;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $month = $request->input('month', Carbon::now()->format('Y-m'));
        $currentMonthStart = Carbon::parse($month.'-01')->startOfMonth();
        $currentMonthEnd = Carbon::parse($month.'-01')->endOfMonth();

        $prevMonthStart = (clone $currentMonthStart)->subMonth()->startOfMonth();
        $prevMonthEnd = (clone $currentMonthStart)->subMonth()->endOfMonth();

        // 1. Akun & Total Saldo
        $accounts = $user->accounts()->where('is_active', true)->withCount('transactions')->get();
        $totalBalance = 0;
        $accountsData = $accounts->map(function (Account $a) use (&$totalBalance) {
            $bal = (float) $a->balance;
            $totalBalance += $bal;
            return [
                'id' => $a->id,
                'name' => $a->name,
                'type' => $a->type,
                'opening_balance' => (string) $a->opening_balance,
                'start_date' => $a->start_date ? $a->start_date->format('Y-m-d') : null,
                'color' => $a->color,
                'icon' => $a->icon,
                'is_active' => (bool) $a->is_active,
                'notes' => $a->notes,
                'balance' => (string) $a->balance,
                'transactions_count' => $a->transactions_count,
            ];
        });

        // 2. Transaksi Bulan Ini vs Bulan Lalu
        $monthTx = $user->transactions()
            ->whereBetween('date', [$currentMonthStart->toDateString(), $currentMonthEnd->toDateString()])
            ->where('type', '!=', 'transfer')
            ->get();

        $income = (float) $monthTx->where('flow', 'in')->sum('amount');
        $expense = (float) $monthTx->where('flow', 'out')->sum('amount');
        $net = $income - $expense;
        $txCount = $monthTx->count();

        $prevMonthTx = $user->transactions()
            ->whereBetween('date', [$prevMonthStart->toDateString(), $prevMonthEnd->toDateString()])
            ->where('type', '!=', 'transfer')
            ->get();

        $prevIncome = (float) $prevMonthTx->where('flow', 'in')->sum('amount');
        $prevExpense = (float) $prevMonthTx->where('flow', 'out')->sum('amount');
        $prevNet = $prevIncome - $prevExpense;

        $incomeChange = $prevIncome > 0 ? (($income - $prevIncome) / $prevIncome) * 100 : null;
        $expenseChange = $prevExpense > 0 ? (($expense - $prevExpense) / $prevExpense) * 100 : null;
        $netChange = $prevNet != 0 ? (($net - $prevNet) / abs($prevNet)) * 100 : null;
        $savingsRate = $income > 0 ? max(0, ($net / $income) * 100) : null;

        // 3. Breakdown Pengeluaran Kategori Bulan Ini
        $catExpenses = $user->transactions()
            ->whereBetween('date', [$currentMonthStart->toDateString(), $currentMonthEnd->toDateString()])
            ->where('flow', 'out')
            ->where('type', '!=', 'transfer')
            ->with('category')
            ->selectRaw('category_id, sum(amount) as total, count(*) as count')
            ->groupBy('category_id')
            ->orderByDesc('total')
            ->get();

        $expenseByCategory = $catExpenses->map(function ($row) use ($expense) {
            $tot = (float) $row->total;
            $pct = $expense > 0 ? round(($tot / $expense) * 100, 1) : 0;
            return [
                'category_id' => $row->category_id,
                'name' => $row->category ? $row->category->name : 'Lainnya',
                'color' => $row->category ? $row->category->color : '#94A3B8',
                'icon' => $row->category ? $row->category->icon : 'tag',
                'total' => number_format($tot, 2, '.', ''),
                'count' => (int) $row->count,
                'percent' => $pct,
            ];
        });

        // 4. Budget summary
        $budgets = $user->budgets()->where('month', $month)->get();
        $totalBudgeted = (float) $budgets->whereNotNull('category_id')->sum('amount');
        $overallBudget = $budgets->firstWhere('category_id', null);
        if ($overallBudget && $totalBudgeted == 0) {
            $totalBudgeted = (float) $overallBudget->amount;
        }

        $budgetSpent = 0;
        $overCount = 0;
        $warningCount = 0;
        foreach ($budgets->whereNotNull('category_id') as $b) {
            $catSpent = (float) ($monthTx->where('category_id', $b->category_id)->where('flow', 'out')->sum('amount'));
            $budgetSpent += $catSpent;
            $bAmt = (float) $b->amount;
            if ($bAmt > 0) {
                $pct = ($catSpent / $bAmt) * 100;
                if ($pct > 100) $overCount++;
                elseif ($pct >= 75) $warningCount++;
            }
        }

        $budgetRemaining = max(0, $totalBudgeted - $budgetSpent);
        $budgetPercent = $totalBudgeted > 0 ? round(($budgetSpent / $totalBudgeted) * 100, 1) : 0;

        // 5. Goals
        $goals = $user->savingsGoals()->with('account')->orderBy('priority')->take(4)->get()->map(function (SavingsGoal $g) {
            $target = (float) $g->target_amount;
            $saved = (float) $g->saved_amount;
            return [
                'id' => $g->id,
                'name' => $g->name,
                'target_amount' => (string) $g->target_amount,
                'saved_amount' => number_format($saved, 2, '.', ''),
                'remaining' => number_format(max(0, $target - $saved), 2, '.', ''),
                'percent' => $target > 0 ? round(min(100, ($saved / $target) * 100), 1) : 0,
                'deadline' => $g->deadline ? $g->deadline->format('Y-m-d') : null,
                'icon' => $g->icon,
                'color' => $g->color,
                'priority' => (int) $g->priority,
                'account_id' => $g->account_id,
                'account' => $g->account ? ['id' => $g->account->id, 'name' => $g->account->name, 'balance' => (string) $g->account->balance] : null,
                'notes' => $g->notes,
                'status' => $g->status,
                'required_per_month' => null,
                'required_per_week' => null,
                'months_left' => null,
            ];
        });

        // 6. Recent Transactions (10 transaksi terbaru)
        $recentTransactions = $user->transactions()
            ->with(['account', 'category', 'transferAsSender.toAccount', 'transferAsReceiver.fromAccount'])
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc')
            ->take(10)
            ->get()
            ->map(function (Transaction $t) {
                $transferData = null;
                if ($t->type === 'transfer') {
                    $tr = $t->transferAsSender ?? $t->transferAsReceiver;
                    if ($tr) {
                        $transferData = [
                            'id' => $tr->id,
                            'from_account_id' => $tr->from_account_id,
                            'to_account_id' => $tr->to_account_id,
                            'from_account' => $tr->fromAccount?->name,
                            'to_account' => $tr->toAccount?->name,
                        ];
                    }
                }
                return [
                    'id' => $t->id,
                    'type' => $t->type,
                    'flow' => $t->flow,
                    'date' => $t->date ? $t->date->format('Y-m-d') : null,
                    'amount' => (string) $t->amount,
                    'description' => $t->description,
                    'notes' => $t->notes,
                    'counterparty' => $t->counterparty,
                    'account_id' => $t->account_id,
                    'category_id' => $t->category_id,
                    'account' => $t->account ? ['id' => $t->account->id, 'name' => $t->account->name, 'color' => $t->account->color, 'icon' => $t->account->icon, 'type' => $t->account->type] : null,
                    'category' => $t->category ? ['id' => $t->category->id, 'name' => $t->category->name, 'color' => $t->category->color, 'icon' => $t->category->icon, 'type' => $t->category->type] : null,
                    'transfer' => $transferData,
                    'has_attachment' => (bool) $t->has_attachment,
                    'attachment_name' => $t->attachment_name,
                    'recurring_id' => $t->recurring_id,
                    'debt_id' => $t->debt_id,
                    'bill_id' => $t->bill_id,
                    'locked_reason' => $t->locked_reason,
                    'created_at' => $t->created_at ? $t->created_at->toISOString() : null,
                ];
            });

        // 7. Upcoming bills
        $upcomingBills = $user->bills()
            ->where('is_active', true)
            ->with(['category', 'account'])
            ->orderBy('next_due_date')
            ->take(5)
            ->get()
            ->map(fn (Bill $b) => [
                'id' => $b->id,
                'name' => $b->name,
                'amount' => (string) $b->amount,
                'category_id' => $b->category_id,
                'category' => $b->category ? ['id' => $b->category->id, 'name' => $b->category->name, 'color' => $b->category->color, 'icon' => $b->category->icon] : null,
                'account_id' => $b->account_id,
                'account' => $b->account ? ['id' => $b->account->id, 'name' => $b->account->name] : null,
                'next_due_date' => $b->next_due_date ? $b->next_due_date->format('Y-m-d') : null,
                'frequency' => $b->frequency,
                'reminder_days' => (int) $b->reminder_days,
                'notes' => $b->notes,
                'is_active' => (bool) $b->is_active,
                'status' => $b->status,
                'days_until_due' => $b->days_until_due,
                'last_paid_date' => $b->last_paid_date,
            ]);

        // 8. Debts summary
        $debts = $user->debts()->with('payments')->get();
        $debtRemaining = 0;
        $recRemaining = 0;
        $debtCount = 0;
        $recCount = 0;
        $overdueCount = 0;
        foreach ($debts as $d) {
            $rem = (float) $d->remaining;
            if ($d->type === 'debt') {
                $debtRemaining += $rem;
                if ($d->status !== 'paid') $debtCount++;
            } else {
                $recRemaining += $rem;
                if ($d->status !== 'paid') $recCount++;
            }
            if ($d->is_overdue) $overdueCount++;
        }

        return response()->json([
            'period' => [
                'month' => $month,
                'date_from' => $currentMonthStart->toDateString(),
                'date_to' => $currentMonthEnd->toDateString(),
                'prev_from' => $prevMonthStart->toDateString(),
                'prev_to' => $prevMonthEnd->toDateString(),
            ],
            'total_balance' => number_format($totalBalance, 2, '.', ''),
            'accounts' => $accountsData,
            'month' => [
                'income' => number_format($income, 2, '.', ''),
                'expense' => number_format($expense, 2, '.', ''),
                'net' => number_format($net, 2, '.', ''),
                'prev_income' => number_format($prevIncome, 2, '.', ''),
                'prev_expense' => number_format($prevExpense, 2, '.', ''),
                'prev_net' => number_format($prevNet, 2, '.', ''),
                'income_change_pct' => $incomeChange !== null ? round($incomeChange, 1) : null,
                'expense_change_pct' => $expenseChange !== null ? round($expenseChange, 1) : null,
                'net_change_pct' => $netChange !== null ? round($netChange, 1) : null,
                'savings_rate' => $savingsRate !== null ? round($savingsRate, 1) : null,
                'transaction_count' => $txCount,
            ],
            'expense_by_category' => $expenseByCategory,
            'budget' => [
                'budgeted' => number_format($totalBudgeted, 2, '.', ''),
                'spent' => number_format($budgetSpent, 2, '.', ''),
                'remaining' => number_format($budgetRemaining, 2, '.', ''),
                'percent' => $budgetPercent,
                'has_budget' => $totalBudgeted > 0,
                'over_count' => $overCount,
                'warning_count' => $warningCount,
            ],
            'goals' => $goals,
            'recent_transactions' => $recentTransactions,
            'upcoming_bills' => $upcomingBills,
            'debts' => [
                'debt_remaining' => number_format($debtRemaining, 2, '.', ''),
                'receivable_remaining' => number_format($recRemaining, 2, '.', ''),
                'debt_count' => $debtCount,
                'receivable_count' => $recCount,
                'overdue_count' => $overdueCount,
            ],
        ]);
    }
}

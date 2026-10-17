<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function cashflow(Request $request): JsonResponse
    {
        $user = $request->user();
        $dateFrom = $request->input('date_from', Carbon::now()->subMonths(6)->startOfMonth()->toDateString());
        $dateTo = $request->input('date_to', Carbon::now()->endOfMonth()->toDateString());
        $interval = $request->input('interval', 'month'); // 'day', 'week', 'month'

        $transactions = $user->transactions()
            ->whereBetween('date', [$dateFrom, $dateTo])
            ->where('type', '!=', 'transfer')
            ->orderBy('date')
            ->get();

        $points = [];
        $start = Carbon::parse($dateFrom);
        $end = Carbon::parse($dateTo);

        if ($interval === 'day') {
            for ($curr = clone $start; $curr->lte($end); $curr->addDay()) {
                $p = $curr->format('Y-m-d');
                $points[$p] = [
                    'period' => $p,
                    'label' => $curr->format('d M'),
                    'income' => 0,
                    'expense' => 0,
                ];
            }
            foreach ($transactions as $t) {
                $p = $t->date->format('Y-m-d');
                if (isset($points[$p])) {
                    if ($t->flow === 'in') $points[$p]['income'] += (float) $t->amount;
                    else $points[$p]['expense'] += (float) $t->amount;
                }
            }
        } else {
            // default month
            for ($curr = clone $start->startOfMonth(); $curr->lte($end); $curr->addMonth()) {
                $p = $curr->format('Y-m');
                $points[$p] = [
                    'period' => $p,
                    'label' => $curr->format('M Y'),
                    'income' => 0,
                    'expense' => 0,
                ];
            }
            foreach ($transactions as $t) {
                $p = $t->date->format('Y-m');
                if (isset($points[$p])) {
                    if ($t->flow === 'in') $points[$p]['income'] += (float) $t->amount;
                    else $points[$p]['expense'] += (float) $t->amount;
                }
            }
        }

        $data = array_values(array_map(function ($pt) {
            $inc = (float) $pt['income'];
            $exp = (float) $pt['expense'];
            return [
                'period' => $pt['period'],
                'label' => $pt['label'],
                'income' => number_format($inc, 2, '.', ''),
                'expense' => number_format($exp, 2, '.', ''),
                'net' => number_format($inc - $exp, 2, '.', ''),
            ];
        }, $points));

        return response()->json(['data' => $data]);
    }

    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $dateFrom = $request->input('date_from', Carbon::now()->startOfMonth()->toDateString());
        $dateTo = $request->input('date_to', Carbon::now()->endOfMonth()->toDateString());

        $dStart = Carbon::parse($dateFrom);
        $dEnd = Carbon::parse($dateTo);
        $days = max(1, $dStart->diffInDays($dEnd) + 1);
        $months = max(1, round($days / 30, 1));

        $txs = $user->transactions()
            ->whereBetween('date', [$dateFrom, $dateTo])
            ->where('type', '!=', 'transfer')
            ->with(['category', 'account'])
            ->get();

        $income = (float) $txs->where('flow', 'in')->sum('amount');
        $expense = (float) $txs->where('flow', 'out')->sum('amount');
        $net = $income - $expense;
        $savingsRate = $income > 0 ? round(max(0, ($net / $income) * 100), 1) : null;

        $avgDaily = $days > 0 ? $expense / $days : 0;
        $avgMonthly = $months > 0 ? $expense / $months : 0;

        // Breakdown expense by category
        $expenseCats = [];
        foreach ($txs->where('flow', 'out') as $t) {
            $catId = $t->category_id;
            if (! isset($expenseCats[$catId])) {
                $expenseCats[$catId] = [
                    'category_id' => $catId,
                    'name' => $t->category ? $t->category->name : 'Lainnya',
                    'color' => $t->category ? $t->category->color : '#94A3B8',
                    'icon' => $t->category ? $t->category->icon : 'tag',
                    'total' => 0,
                    'count' => 0,
                ];
            }
            $expenseCats[$catId]['total'] += (float) $t->amount;
            $expenseCats[$catId]['count']++;
        }
        $expenseByCategory = array_values(array_map(function ($c) use ($expense) {
            $tot = (float) $c['total'];
            return [
                'category_id' => $c['category_id'],
                'name' => $c['name'],
                'color' => $c['color'],
                'icon' => $c['icon'],
                'total' => number_format($tot, 2, '.', ''),
                'count' => $c['count'],
                'percent' => $expense > 0 ? round(($tot / $expense) * 100, 1) : 0,
            ];
        }, $expenseCats));
        usort($expenseByCategory, fn ($a, $b) => $b['percent'] <=> $a['percent']);

        // Breakdown income by category
        $incomeCats = [];
        foreach ($txs->where('flow', 'in') as $t) {
            $catId = $t->category_id;
            if (! isset($incomeCats[$catId])) {
                $incomeCats[$catId] = [
                    'category_id' => $catId,
                    'name' => $t->category ? $t->category->name : 'Lainnya',
                    'color' => $t->category ? $t->category->color : '#94A3B8',
                    'icon' => $t->category ? $t->category->icon : 'tag',
                    'total' => 0,
                    'count' => 0,
                ];
            }
            $incomeCats[$catId]['total'] += (float) $t->amount;
            $incomeCats[$catId]['count']++;
        }
        $incomeByCategory = array_values(array_map(function ($c) use ($income) {
            $tot = (float) $c['total'];
            return [
                'category_id' => $c['category_id'],
                'name' => $c['name'],
                'color' => $c['color'],
                'icon' => $c['icon'],
                'total' => number_format($tot, 2, '.', ''),
                'count' => $c['count'],
                'percent' => $income > 0 ? round(($tot / $income) * 100, 1) : 0,
            ];
        }, $incomeCats));
        usort($incomeByCategory, fn ($a, $b) => $b['percent'] <=> $a['percent']);

        // By account
        $byAccount = [];
        $accounts = $user->accounts()->where('is_active', true)->get();
        foreach ($accounts as $a) {
            $accTxs = $txs->where('account_id', $a->id);
            $accInc = (float) $accTxs->where('flow', 'in')->sum('amount');
            $accExp = (float) $accTxs->where('flow', 'out')->sum('amount');
            $byAccount[] = [
                'account_id' => $a->id,
                'name' => $a->name,
                'color' => $a->color,
                'income' => number_format($accInc, 2, '.', ''),
                'expense' => number_format($accExp, 2, '.', ''),
                'net' => number_format($accInc - $accExp, 2, '.', ''),
            ];
        }

        return response()->json([
            'range' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'days' => $days,
                'months' => $months,
            ],
            'income' => number_format($income, 2, '.', ''),
            'expense' => number_format($expense, 2, '.', ''),
            'net' => number_format($net, 2, '.', ''),
            'savings_rate' => $savingsRate,
            'avg_daily_expense' => number_format($avgDaily, 2, '.', ''),
            'avg_monthly_expense' => number_format($avgMonthly, 2, '.', ''),
            'transaction_count' => $txs->count(),
            'expense_by_category' => $expenseByCategory,
            'income_by_category' => $incomeByCategory,
            'by_account' => $byAccount,
        ]);
    }

    public function balanceTrend(Request $request): JsonResponse
    {
        $user = $request->user();
        $monthsCount = (int) $request->input('months', 6);

        $end = Carbon::now()->endOfMonth();
        $start = Carbon::now()->subMonths($monthsCount - 1)->startOfMonth();

        // Ambil saldo awal semua akun aktif
        $accounts = $user->accounts()->where('is_active', true)->get();
        $openingTotal = (float) $accounts->sum('opening_balance');

        // Transaksi sebelum periode mulai
        $priorIn = (float) $user->transactions()
            ->where('date', '<', $start->toDateString())
            ->where('flow', 'in')
            ->sum('amount');
        $priorOut = (float) $user->transactions()
            ->where('date', '<', $start->toDateString())
            ->where('flow', 'out')
            ->sum('amount');

        $runningBalance = $openingTotal + $priorIn - $priorOut;

        $txs = $user->transactions()
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('date')
            ->get();

        $data = [];
        for ($curr = clone $start; $curr->lte($end); $curr->addMonth()) {
            $mKey = $curr->format('Y-m');
            $mLabel = $curr->format('M Y');

            $mTx = $txs->filter(fn ($t) => $t->date->format('Y-m') === $mKey);
            $mIn = (float) $mTx->where('flow', 'in')->sum('amount');
            $mOut = (float) $mTx->where('flow', 'out')->sum('amount');
            $runningBalance += ($mIn - $mOut);

            $data[] = [
                'period' => $mKey,
                'label' => $mLabel,
                'balance' => number_format($runningBalance, 2, '.', ''),
            ];
        }

        return response()->json(['data' => $data]);
    }

    public function comparison(Request $request): JsonResponse
    {
        $user = $request->user();
        $year = (int) $request->input('year', Carbon::now()->year);
        $prevYear = $year - 1;

        $txCurrent = $user->transactions()
            ->whereYear('date', $year)
            ->where('type', '!=', 'transfer')
            ->get();

        $txPrev = $user->transactions()
            ->whereYear('date', $prevYear)
            ->where('type', '!=', 'transfer')
            ->get();

        $data = [];
        $monthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        for ($m = 1; $m <= 12; $m++) {
            $mStr = str_pad($m, 2, '0', STR_PAD_LEFT);
            $curInc = (float) $txCurrent->filter(fn ($t) => $t->date->format('m') === $mStr && $t->flow === 'in')->sum('amount');
            $curExp = (float) $txCurrent->filter(fn ($t) => $t->date->format('m') === $mStr && $t->flow === 'out')->sum('amount');
            $prevInc = (float) $txPrev->filter(fn ($t) => $t->date->format('m') === $mStr && $t->flow === 'in')->sum('amount');
            $prevExp = (float) $txPrev->filter(fn ($t) => $t->date->format('m') === $mStr && $t->flow === 'out')->sum('amount');

            $data[] = [
                'month' => $m,
                'label' => $monthsNames[$m - 1],
                'income' => number_format($curInc, 2, '.', ''),
                'expense' => number_format($curExp, 2, '.', ''),
                'prev_income' => number_format($prevInc, 2, '.', ''),
                'prev_expense' => number_format($prevExp, 2, '.', ''),
            ];
        }

        return response()->json([
            'year' => $year,
            'data' => $data,
        ]);
    }
}

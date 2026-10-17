<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\Category;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $month = $request->input('month', Carbon::now()->format('Y-m'));

        $startOfMonth = Carbon::parse($month.'-01')->startOfMonth()->toDateString();
        $endOfMonth = Carbon::parse($month.'-01')->endOfMonth()->toDateString();

        // Ambil semua pengeluaran bulan ini yang dikelompokkan berdasarkan kategori
        $expensesByCategory = $user->transactions()
            ->where('flow', 'out')
            ->where('type', '!=', 'transfer')
            ->whereBetween('date', [$startOfMonth, $endOfMonth])
            ->selectRaw('category_id, sum(amount) as total_spent')
            ->groupBy('category_id')
            ->pluck('total_spent', 'category_id')
            ->toArray();

        $totalMonthExpense = array_sum($expensesByCategory);

        // Ambil budget bulan ini
        $budgets = $user->budgets()->with('category')->where('month', $month)->get();

        $overallBudget = $budgets->firstWhere('category_id', null);
        $overallRow = null;
        if ($overallBudget) {
            $budgetAmt = (float) $overallBudget->amount;
            $spent = (float) $totalMonthExpense;
            $rem = $budgetAmt - $spent;
            $pct = $budgetAmt > 0 ? ($spent / $budgetAmt) * 100 : 0;
            $overallRow = [
                'id' => $overallBudget->id,
                'category_id' => null,
                'category' => null,
                'amount' => number_format($budgetAmt, 2, '.', ''),
                'spent' => number_format($spent, 2, '.', ''),
                'remaining' => number_format($rem, 2, '.', ''),
                'percent' => round($pct, 1),
                'level' => $this->getBudgetLevel($pct),
                'is_recurring' => (bool) $overallBudget->is_recurring,
            ];
        }

        $categoryBudgets = $budgets->whereNotNull('category_id');
        $budgetedSpentTotal = 0;
        $totalBudgeted = 0;

        $categoryRows = [];
        foreach ($categoryBudgets as $b) {
            $catId = $b->category_id;
            $spent = (float) ($expensesByCategory[$catId] ?? 0);
            $budgetedSpentTotal += $spent;
            $budgetAmt = (float) $b->amount;
            $totalBudgeted += $budgetAmt;
            $rem = $budgetAmt - $spent;
            $pct = $budgetAmt > 0 ? ($spent / $budgetAmt) * 100 : 0;

            $categoryRows[] = [
                'id' => $b->id,
                'category_id' => $catId,
                'category' => $b->category ? [
                    'id' => $b->category->id,
                    'name' => $b->category->name,
                    'color' => $b->category->color,
                    'icon' => $b->category->icon,
                ] : null,
                'amount' => number_format($budgetAmt, 2, '.', ''),
                'spent' => number_format($spent, 2, '.', ''),
                'remaining' => number_format($rem, 2, '.', ''),
                'percent' => round($pct, 1),
                'level' => $this->getBudgetLevel($pct),
                'is_recurring' => (bool) $b->is_recurring,
            ];
        }

        $unbudgetedSpent = max(0, $totalMonthExpense - $budgetedSpentTotal);
        $totalRemaining = $totalBudgeted - $budgetedSpentTotal;
        $totalPercent = $totalBudgeted > 0 ? ($budgetedSpentTotal / $totalBudgeted) * 100 : 0;

        return response()->json([
            'month' => $month,
            'overall' => $overallRow,
            'categories' => $categoryRows,
            'totals' => [
                'budgeted' => number_format($totalBudgeted, 2, '.', ''),
                'spent' => number_format($budgetedSpentTotal, 2, '.', ''),
                'remaining' => number_format($totalRemaining, 2, '.', ''),
                'percent' => round($totalPercent, 1),
                'month_expense' => number_format($totalMonthExpense, 2, '.', ''),
                'unbudgeted_spent' => number_format($unbudgetedSpent, 2, '.', ''),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'category_id' => 'nullable|exists:categories,id',
            'month' => 'required|date_format:Y-m',
            'amount' => 'required|numeric|min:0',
            'is_recurring' => 'nullable|boolean',
        ]);

        $amount = number_format((float) $validated['amount'], 2, '.', '');
        $budget = Budget::updateOrCreate(
            [
                'user_id' => $user->id,
                'category_id' => $validated['category_id'] ?? null,
                'month' => $validated['month'],
            ],
            [
                'amount' => $amount,
                'is_recurring' => (bool) ($validated['is_recurring'] ?? true),
            ]
        );

        return response()->json(['data' => $budget], 200);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $budget = $request->user()->budgets()->findOrFail($id);
        $budget->delete();

        return response()->json(['message' => 'Anggaran berhasil dihapus.']);
    }

    protected function getBudgetLevel(float $pct): string
    {
        if ($pct > 100) {
            return 'over';
        }
        if ($pct >= 90) {
            return 'danger';
        }
        if ($pct >= 75) {
            return 'warning';
        }
        if ($pct >= 50) {
            return 'half';
        }

        return 'safe';
    }
}

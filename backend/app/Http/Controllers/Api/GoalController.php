<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SavingsContribution;
use App\Models\SavingsGoal;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GoalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $goals = $request->user()->savingsGoals()->with(['account', 'contributions'])->orderBy('priority')->get();

        $data = $goals->map(fn (SavingsGoal $g) => $this->formatGoal($g));

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'target_amount' => 'required|numeric|min:1',
            'deadline' => 'nullable|date',
            'icon' => 'required|string|max:50',
            'color' => 'required|string|max:20',
            'priority' => 'nullable|integer|min:1',
            'account_id' => 'nullable|exists:accounts,id',
            'notes' => 'nullable|string|max:500',
        ]);

        $goal = $user->savingsGoals()->create(array_merge($validated, [
            'status' => 'active',
            'priority' => $validated['priority'] ?? 1,
            'target_amount' => number_format((float) $validated['target_amount'], 2, '.', ''),
        ]));

        return response()->json(['data' => $this->formatGoal($goal->fresh(['account', 'contributions']))], 201);
    }

    public function show(Request $request, $id): JsonResponse
    {
        $goal = $request->user()->savingsGoals()->with(['account', 'contributions'])->findOrFail($id);

        return response()->json(['data' => $this->formatGoal($goal, true)]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $goal = $request->user()->savingsGoals()->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'target_amount' => 'sometimes|numeric|min:1',
            'deadline' => 'nullable|date',
            'icon' => 'sometimes|string|max:50',
            'color' => 'sometimes|string|max:20',
            'priority' => 'sometimes|integer|min:1',
            'account_id' => 'nullable|exists:accounts,id',
            'notes' => 'nullable|string|max:500',
            'status' => 'sometimes|in:active,achieved',
        ]);

        if (isset($validated['target_amount'])) {
            $validated['target_amount'] = number_format((float) $validated['target_amount'], 2, '.', '');
        }

        $goal->update($validated);

        return response()->json(['data' => $this->formatGoal($goal->fresh(['account', 'contributions']))]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $goal = $request->user()->savingsGoals()->findOrFail($id);
        $goal->delete();

        return response()->json(['message' => 'Target tabungan berhasil dihapus.']);
    }

    public function contribute(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $goal = $user->savingsGoals()->findOrFail($id);

        $validated = $request->validate([
            'type' => 'required|in:deposit,withdrawal',
            'amount' => 'required|numeric|min:1',
            'date' => 'required|date',
            'note' => 'nullable|string|max:255',
        ]);

        $amount = number_format((float) $validated['amount'], 2, '.', '');

        DB::transaction(function () use ($user, $goal, $validated, $amount) {
            SavingsContribution::create([
                'savings_goal_id' => $goal->id,
                'user_id' => $user->id,
                'type' => $validated['type'],
                'amount' => $amount,
                'date' => $validated['date'],
                'note' => $validated['note'] ?? null,
            ]);

            // Jika setoran mencapai atau melebihi target, otomatis tandai 'achieved'
            $saved = (float) $goal->fresh()->saved_amount;
            $target = (float) $goal->target_amount;
            if ($saved >= $target && $goal->status === 'active') {
                $goal->update(['status' => 'achieved']);
            } elseif ($saved < $target && $goal->status === 'achieved') {
                $goal->update(['status' => 'active']);
            }
        });

        return response()->json(['data' => $this->formatGoal($goal->fresh(['account', 'contributions']), true)]);
    }

    protected function formatGoal(SavingsGoal $g, bool $includeContributions = false): array
    {
        $target = (float) $g->target_amount;
        $saved = (float) $g->saved_amount;
        $rem = max(0, $target - $saved);
        $pct = $target > 0 ? min(100, ($saved / $target) * 100) : 0;

        $monthsLeft = null;
        $reqPerMonth = null;
        $reqPerWeek = null;

        if ($g->deadline) {
            $today = Carbon::today();
            $d = Carbon::parse($g->deadline);
            if ($d->isFuture()) {
                $diffMonths = max(1, $today->diffInMonths($d));
                $diffWeeks = max(1, $today->diffInWeeks($d));
                $monthsLeft = (int) $diffMonths;
                if ($rem > 0) {
                    $reqPerMonth = number_format($rem / $diffMonths, 2, '.', '');
                    $reqPerWeek = number_format($rem / $diffWeeks, 2, '.', '');
                }
            }
        }

        $res = [
            'id' => $g->id,
            'name' => $g->name,
            'target_amount' => (string) $g->target_amount,
            'saved_amount' => number_format($saved, 2, '.', ''),
            'remaining' => number_format($rem, 2, '.', ''),
            'percent' => round($pct, 1),
            'deadline' => $g->deadline ? $g->deadline->format('Y-m-d') : null,
            'icon' => $g->icon,
            'color' => $g->color,
            'priority' => (int) $g->priority,
            'account_id' => $g->account_id,
            'account' => $g->account ? [
                'id' => $g->account->id,
                'name' => $g->account->name,
                'balance' => (string) $g->account->balance,
            ] : null,
            'notes' => $g->notes,
            'status' => $g->status,
            'required_per_month' => $reqPerMonth,
            'required_per_week' => $reqPerWeek,
            'months_left' => $monthsLeft,
        ];

        if ($includeContributions) {
            $res['contributions'] = $g->contributions->map(fn (SavingsContribution $c) => [
                'id' => $c->id,
                'type' => $c->type,
                'amount' => (string) $c->amount,
                'date' => $c->date ? $c->date->format('Y-m-d') : null,
                'note' => $c->note,
                'created_at' => $c->created_at ? $c->created_at->toISOString() : null,
            ])->toArray();
        }

        return $res;
    }
}

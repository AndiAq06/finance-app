<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Recurring;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RecurringController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $recurrings = $request->user()->recurrings()->with(['account', 'category'])->orderBy('created_at', 'desc')->get();

        $data = $recurrings->map(fn (Recurring $r) => $this->formatRecurring($r));

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'type' => 'required|in:income,expense',
            'amount' => 'required|numeric|min:1',
            'account_id' => 'required|exists:accounts,id',
            'category_id' => 'required|exists:categories,id',
            'description' => 'required|string|max:255',
            'frequency' => 'required|in:daily,weekly,monthly,yearly',
            'interval' => 'nullable|integer|min:1',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $rec = $user->recurrings()->create(array_merge($validated, [
            'amount' => number_format((float) $validated['amount'], 2, '.', ''),
            'interval' => $validated['interval'] ?? 1,
            'next_run_date' => $validated['start_date'],
            'is_active' => true,
            'generated_count' => 0,
        ]));

        return response()->json(['data' => $this->formatRecurring($rec->fresh(['account', 'category']))], 201);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $rec = $request->user()->recurrings()->findOrFail($id);

        $validated = $request->validate([
            'type' => 'sometimes|in:income,expense',
            'amount' => 'sometimes|numeric|min:1',
            'account_id' => 'sometimes|exists:accounts,id',
            'category_id' => 'sometimes|exists:categories,id',
            'description' => 'sometimes|string|max:255',
            'frequency' => 'sometimes|in:daily,weekly,monthly,yearly',
            'interval' => 'sometimes|integer|min:1',
            'start_date' => 'sometimes|date',
            'end_date' => 'nullable|date',
            'is_active' => 'sometimes|boolean',
        ]);

        if (isset($validated['amount'])) {
            $validated['amount'] = number_format((float) $validated['amount'], 2, '.', '');
        }

        $rec->update($validated);

        return response()->json(['data' => $this->formatRecurring($rec->fresh(['account', 'category']))]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $rec = $request->user()->recurrings()->findOrFail($id);
        $rec->delete();

        return response()->json(['message' => 'Jadwal transaksi rutin berhasil dihapus.']);
    }

    public function runPending(Request $request): JsonResponse
    {
        $user = $request->user();
        $today = Carbon::today()->format('Y-m-d');

        $dueRecurrings = $user->recurrings()
            ->where('is_active', true)
            ->whereNotNull('next_run_date')
            ->where('next_run_date', '<=', $today)
            ->get();

        $generated = 0;
        foreach ($dueRecurrings as $rec) {
            DB::transaction(function () use ($user, $rec, &$generated) {
                $runDate = $rec->next_run_date->format('Y-m-d');
                Transaction::create([
                    'user_id' => $user->id,
                    'account_id' => $rec->account_id,
                    'category_id' => $rec->category_id,
                    'type' => $rec->type,
                    'flow' => $rec->type === 'income' ? 'in' : 'out',
                    'date' => $runDate,
                    'amount' => $rec->amount,
                    'description' => $rec->description,
                    'recurring_id' => $rec->id,
                ]);

                // Hitung jadwal berikutnya
                $next = Carbon::parse($runDate);
                $interval = (int) $rec->interval ?: 1;
                if ($rec->frequency === 'daily') {
                    $next->addDays($interval);
                } elseif ($rec->frequency === 'weekly') {
                    $next->addWeeks($interval);
                } elseif ($rec->frequency === 'yearly') {
                    $next->addYears($interval);
                } else {
                    $next->addMonths($interval);
                }

                $isActive = true;
                if ($rec->end_date && $next->isAfter($rec->end_date)) {
                    $isActive = false;
                }

                $rec->update([
                    'last_run_date' => $runDate,
                    'next_run_date' => $isActive ? $next->format('Y-m-d') : null,
                    'is_active' => $isActive,
                    'generated_count' => $rec->generated_count + 1,
                ]);

                $generated++;
            });
        }

        return response()->json(['message' => "Berhasil memproses {$generated} transaksi rutin."]);
    }

    protected function formatRecurring(Recurring $r): array
    {
        return [
            'id' => $r->id,
            'type' => $r->type,
            'amount' => (string) $r->amount,
            'account_id' => $r->account_id,
            'category_id' => $r->category_id,
            'account' => $r->account ? [
                'id' => $r->account->id,
                'name' => $r->account->name,
            ] : null,
            'category' => $r->category ? [
                'id' => $r->category->id,
                'name' => $r->category->name,
                'color' => $r->category->color,
                'icon' => $r->category->icon,
            ] : null,
            'description' => $r->description,
            'frequency' => $r->frequency,
            'interval' => (int) $r->interval,
            'start_date' => $r->start_date ? $r->start_date->format('Y-m-d') : null,
            'end_date' => $r->end_date ? $r->end_date->format('Y-m-d') : null,
            'next_run_date' => $r->next_run_date ? $r->next_run_date->format('Y-m-d') : null,
            'last_run_date' => $r->last_run_date ? $r->last_run_date->format('Y-m-d') : null,
            'is_active' => (bool) $r->is_active,
            'generated_count' => (int) $r->generated_count,
        ];
    }
}

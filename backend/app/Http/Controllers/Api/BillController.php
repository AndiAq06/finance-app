<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\BillPayment;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BillController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $bills = $request->user()->bills()->with(['category', 'account'])->orderBy('next_due_date')->get();

        $data = $bills->map(fn (Bill $b) => $this->formatBill($b));

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'amount' => 'required|numeric|min:1',
            'category_id' => 'nullable|exists:categories,id',
            'account_id' => 'nullable|exists:accounts,id',
            'next_due_date' => 'nullable|date',
            'frequency' => 'required|in:weekly,monthly,yearly',
            'reminder_days' => 'nullable|integer|min:0|max:30',
            'notes' => 'nullable|string|max:500',
        ]);

        $bill = $user->bills()->create(array_merge($validated, [
            'is_active' => true,
            'amount' => number_format((float) $validated['amount'], 2, '.', ''),
            'reminder_days' => $validated['reminder_days'] ?? 3,
        ]));

        return response()->json(['data' => $this->formatBill($bill->fresh(['category', 'account']))], 201);
    }

    public function show(Request $request, $id): JsonResponse
    {
        $bill = $request->user()->bills()->with(['category', 'account', 'payments'])->findOrFail($id);

        return response()->json(['data' => $this->formatBill($bill, true)]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $bill = $request->user()->bills()->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'amount' => 'sometimes|numeric|min:1',
            'category_id' => 'nullable|exists:categories,id',
            'account_id' => 'nullable|exists:accounts,id',
            'next_due_date' => 'nullable|date',
            'frequency' => 'sometimes|in:weekly,monthly,yearly',
            'reminder_days' => 'sometimes|integer|min:0|max:30',
            'notes' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        if (isset($validated['amount'])) {
            $validated['amount'] = number_format((float) $validated['amount'], 2, '.', '');
        }

        $bill->update($validated);

        return response()->json(['data' => $this->formatBill($bill->fresh(['category', 'account']))]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $bill = $request->user()->bills()->findOrFail($id);
        $bill->delete();

        return response()->json(['message' => 'Tagihan berhasil dihapus.']);
    }

    public function pay(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $bill = $user->bills()->findOrFail($id);

        $validated = $request->validate([
            'paid_date' => 'required|date',
            'account_id' => 'nullable|exists:accounts,id',
            'create_transaction' => 'nullable|boolean',
        ]);

        $paidDate = Carbon::parse($validated['paid_date']);
        $periodDueDate = $bill->next_due_date ?: $paidDate;
        $accId = $validated['account_id'] ?? $bill->account_id;

        DB::transaction(function () use ($user, $bill, $paidDate, $periodDueDate, $accId, $validated) {
            $txId = null;
            if (! empty($validated['create_transaction']) && $accId) {
                $tx = Transaction::create([
                    'user_id' => $user->id,
                    'account_id' => $accId,
                    'category_id' => $bill->category_id,
                    'type' => 'expense',
                    'flow' => 'out',
                    'date' => $paidDate->format('Y-m-d'),
                    'amount' => $bill->amount,
                    'description' => "Bayar tagihan: {$bill->name}",
                    'bill_id' => $bill->id,
                ]);
                $txId = $tx->id;
            }

            BillPayment::create([
                'bill_id' => $bill->id,
                'user_id' => $user->id,
                'transaction_id' => $txId,
                'period_due_date' => Carbon::parse($periodDueDate)->format('Y-m-d'),
                'paid_date' => $paidDate->format('Y-m-d'),
                'amount' => $bill->amount,
            ]);

            // Majukan tanggal jatuh tempo berikutnya
            if ($bill->next_due_date) {
                $next = Carbon::parse($bill->next_due_date);
                if ($bill->frequency === 'weekly') {
                    $next->addWeek();
                } elseif ($bill->frequency === 'yearly') {
                    $next->addYear();
                } else {
                    $next->addMonth();
                }
                $bill->update(['next_due_date' => $next->format('Y-m-d')]);
            }
        });

        return response()->json(['data' => $this->formatBill($bill->fresh(['category', 'account', 'payments']), true)]);
    }

    protected function formatBill(Bill $b, bool $includePayments = false): array
    {
        $res = [
            'id' => $b->id,
            'name' => $b->name,
            'amount' => (string) $b->amount,
            'category_id' => $b->category_id,
            'category' => $b->category ? [
                'id' => $b->category->id,
                'name' => $b->category->name,
                'color' => $b->category->color,
                'icon' => $b->category->icon,
            ] : null,
            'account_id' => $b->account_id,
            'account' => $b->account ? [
                'id' => $b->account->id,
                'name' => $b->account->name,
            ] : null,
            'next_due_date' => $b->next_due_date ? $b->next_due_date->format('Y-m-d') : null,
            'frequency' => $b->frequency,
            'reminder_days' => (int) $b->reminder_days,
            'notes' => $b->notes,
            'is_active' => (bool) $b->is_active,
            'status' => $b->status,
            'days_until_due' => $b->days_until_due,
            'last_paid_date' => $b->last_paid_date,
        ];

        if ($includePayments) {
            $res['payments'] = $b->payments->map(fn (BillPayment $p) => [
                'id' => $p->id,
                'period_due_date' => $p->period_due_date ? $p->period_due_date->format('Y-m-d') : null,
                'paid_date' => $p->paid_date ? $p->paid_date->format('Y-m-d') : null,
                'amount' => (string) $p->amount,
                'transaction_id' => $p->transaction_id,
            ])->toArray();
        }

        return $res;
    }
}

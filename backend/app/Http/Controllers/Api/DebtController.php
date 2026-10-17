<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DebtController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = $user->debts()->with('payments');

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $allDebts = $user->debts()->with('payments')->get();
        $debtRemaining = 0;
        $receivableRemaining = 0;
        $debtCount = 0;
        $receivableCount = 0;
        $overdueCount = 0;

        foreach ($allDebts as $d) {
            $rem = (float) $d->remaining;
            if ($d->type === 'debt') {
                $debtRemaining += $rem;
                if ($d->status !== 'paid') {
                    $debtCount++;
                }
            } else {
                $receivableRemaining += $rem;
                if ($d->status !== 'paid') {
                    $receivableCount++;
                }
            }
            if ($d->is_overdue) {
                $overdueCount++;
            }
        }

        $debts = $query->orderBy('due_date', 'asc')->orderBy('date', 'desc')->get();
        $data = $debts->map(fn (Debt $d) => $this->formatDebt($d));

        return response()->json([
            'data' => $data,
            'summary' => [
                'debt_remaining' => number_format($debtRemaining, 2, '.', ''),
                'receivable_remaining' => number_format($receivableRemaining, 2, '.', ''),
                'debt_count' => $debtCount,
                'receivable_count' => $receivableCount,
                'overdue_count' => $overdueCount,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'type' => 'required|in:debt,receivable',
            'party_name' => 'required|string|max:100',
            'amount' => 'required|numeric|min:1',
            'date' => 'required|date',
            'due_date' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
            'account_id' => 'nullable|exists:accounts,id',
        ]);

        $debt = $user->debts()->create(array_merge($validated, [
            'status' => 'unpaid',
            'amount' => number_format((float) $validated['amount'], 2, '.', ''),
        ]));

        return response()->json(['data' => $this->formatDebt($debt->fresh('payments'))], 201);
    }

    public function show(Request $request, $id): JsonResponse
    {
        $debt = $request->user()->debts()->with(['payments.account'])->findOrFail($id);

        return response()->json(['data' => $this->formatDebt($debt, true)]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $debt = $request->user()->debts()->findOrFail($id);

        $validated = $request->validate([
            'type' => 'sometimes|in:debt,receivable',
            'party_name' => 'sometimes|string|max:100',
            'amount' => 'sometimes|numeric|min:1',
            'date' => 'sometimes|date',
            'due_date' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
            'account_id' => 'nullable|exists:accounts,id',
            'status' => 'sometimes|in:unpaid,partial,paid',
        ]);

        if (isset($validated['amount'])) {
            $validated['amount'] = number_format((float) $validated['amount'], 2, '.', '');
        }

        $debt->update($validated);

        return response()->json(['data' => $this->formatDebt($debt->fresh('payments'))]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $debt = $request->user()->debts()->findOrFail($id);
        $debt->delete();

        return response()->json(['message' => 'Catatan hutang/piutang berhasil dihapus.']);
    }

    public function pay(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $debt = $user->debts()->findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:1',
            'date' => 'required|date',
            'account_id' => 'nullable|exists:accounts,id',
            'note' => 'nullable|string|max:255',
            'create_transaction' => 'nullable|boolean',
        ]);

        $amount = number_format((float) $validated['amount'], 2, '.', '');

        DB::transaction(function () use ($user, $debt, $validated, $amount) {
            $txId = null;
            if (! empty($validated['create_transaction']) && ! empty($validated['account_id'])) {
                // Jika jenisnya debt (hutang kita), bayar = uang keluar (flow=out)
                // Jika jenisnya receivable (piutang kita), terima bayar = uang masuk (flow=in)
                $flow = $debt->type === 'debt' ? 'out' : 'in';
                $desc = $debt->type === 'debt' ? "Bayar hutang ke {$debt->party_name}" : "Terima bayar piutang dari {$debt->party_name}";

                $tx = Transaction::create([
                    'user_id' => $user->id,
                    'account_id' => $validated['account_id'],
                    'type' => 'debt',
                    'flow' => $flow,
                    'date' => $validated['date'],
                    'amount' => $amount,
                    'description' => $desc,
                    'notes' => $validated['note'] ?? null,
                    'counterparty' => $debt->party_name,
                    'debt_id' => $debt->id,
                ]);
                $txId = $tx->id;
            }

            DebtPayment::create([
                'debt_id' => $debt->id,
                'user_id' => $user->id,
                'account_id' => $validated['account_id'] ?? null,
                'transaction_id' => $txId,
                'amount' => $amount,
                'date' => $validated['date'],
                'note' => $validated['note'] ?? null,
            ]);

            // Update status
            $totalPaid = (float) $debt->payments()->sum('amount');
            $origAmount = (float) $debt->amount;
            if ($totalPaid >= $origAmount) {
                $debt->update(['status' => 'paid']);
            } elseif ($totalPaid > 0) {
                $debt->update(['status' => 'partial']);
            } else {
                $debt->update(['status' => 'unpaid']);
            }
        });

        return response()->json(['data' => $this->formatDebt($debt->fresh('payments'), true)]);
    }

    protected function formatDebt(Debt $d, bool $includePayments = false): array
    {
        $paid = (float) $d->paid_amount;
        $amount = (float) $d->amount;
        $rem = max(0, $amount - $paid);

        $res = [
            'id' => $d->id,
            'type' => $d->type,
            'party_name' => $d->party_name,
            'amount' => (string) $d->amount,
            'paid_amount' => number_format($paid, 2, '.', ''),
            'remaining' => number_format($rem, 2, '.', ''),
            'date' => $d->date ? $d->date->format('Y-m-d') : null,
            'due_date' => $d->due_date ? $d->due_date->format('Y-m-d') : null,
            'notes' => $d->notes,
            'status' => $d->status,
            'account_id' => $d->account_id,
            'is_overdue' => $d->is_overdue,
        ];

        if ($includePayments) {
            $res['payments'] = $d->payments->map(fn (DebtPayment $p) => [
                'id' => $p->id,
                'amount' => (string) $p->amount,
                'date' => $p->date ? $p->date->format('Y-m-d') : null,
                'account_id' => $p->account_id,
                'account' => $p->account?->name,
                'note' => $p->note,
                'transaction_id' => $p->transaction_id,
            ])->toArray();
        }

        return $res;
    }
}

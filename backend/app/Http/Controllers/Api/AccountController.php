<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = $user->accounts()->withCount('transactions');

        if (! $request->boolean('include_inactive')) {
            $query->where('is_active', true);
        }

        $accounts = $query->orderBy('name')->get();
        $totalBalance = 0;

        $data = $accounts->map(function (Account $a) use (&$totalBalance) {
            $bal = (float) $a->balance;
            if ($a->is_active) {
                $totalBalance += $bal;
            }

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

        return response()->json([
            'data' => $data,
            'total_balance' => number_format($totalBalance, 2, '.', ''),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'required|in:cash,bank,ewallet,savings,other',
            'opening_balance' => 'required|numeric',
            'start_date' => 'required|date',
            'color' => 'required|string|max:20',
            'icon' => 'required|string|max:50',
            'notes' => 'nullable|string|max:500',
        ]);

        $account = $user->accounts()->create(array_merge($validated, [
            'is_active' => true,
        ]));

        return response()->json(['data' => $account], 201);
    }

    public function show(Request $request, $id): JsonResponse
    {
        $account = $request->user()->accounts()->withCount('transactions')->findOrFail($id);

        return response()->json([
            'data' => [
                'id' => $account->id,
                'name' => $account->name,
                'type' => $account->type,
                'opening_balance' => (string) $account->opening_balance,
                'start_date' => $account->start_date ? $account->start_date->format('Y-m-d') : null,
                'color' => $account->color,
                'icon' => $account->icon,
                'is_active' => (bool) $account->is_active,
                'notes' => $account->notes,
                'balance' => (string) $account->balance,
                'transactions_count' => $account->transactions_count,
            ],
        ]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $account = $request->user()->accounts()->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'type' => 'sometimes|in:cash,bank,ewallet,savings,other',
            'opening_balance' => 'sometimes|numeric',
            'start_date' => 'sometimes|date',
            'color' => 'sometimes|string|max:20',
            'icon' => 'sometimes|string|max:50',
            'is_active' => 'sometimes|boolean',
            'notes' => 'nullable|string|max:500',
        ]);

        $account->update($validated);

        return response()->json(['data' => $account]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $account = $request->user()->accounts()->findOrFail($id);

        // Jangan hapus akun jika sudah ada transaksi, melainkan ubah status ke nonaktif
        if ($account->transactions()->exists()) {
            $account->update(['is_active' => false]);
            return response()->json(['message' => 'Akun dinonaktifkan karena memiliki riwayat transaksi.'], 200);
        }

        $account->delete();

        return response()->json(['message' => 'Akun berhasil dihapus.'], 200);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $month = $request->input('month', Carbon::now()->format('Y-m'));

        $start = Carbon::parse($month.'-01')->startOfMonth();
        $end = Carbon::parse($month.'-01')->endOfMonth();

        // Ambil transaksi per hari dalam bulan tersebut
        $txs = $user->transactions()
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->where('type', '!=', 'transfer')
            ->get();

        $days = [];
        for ($curr = clone $start; $curr->lte($end); $curr->addDay()) {
            $dStr = $curr->format('Y-m-d');
            $dayTxs = $txs->filter(fn ($t) => $t->date->format('Y-m-d') === $dStr);
            $inc = (float) $dayTxs->where('flow', 'in')->sum('amount');
            $exp = (float) $dayTxs->where('flow', 'out')->sum('amount');
            $cnt = $dayTxs->count();

            if ($cnt > 0) {
                $days[$dStr] = [
                    'income' => number_format($inc, 2, '.', ''),
                    'expense' => number_format($exp, 2, '.', ''),
                    'count' => $cnt,
                ];
            }
        }

        // Ambil tagihan yang jatuh tempo di bulan ini
        $bills = $user->bills()
            ->where('is_active', true)
            ->whereNotNull('next_due_date')
            ->whereBetween('next_due_date', [$start->toDateString(), $end->toDateString()])
            ->get()
            ->map(fn ($b) => [
                'bill_id' => $b->id,
                'name' => $b->name,
                'date' => $b->next_due_date->format('Y-m-d'),
                'amount' => (string) $b->amount,
                'status' => $b->status,
            ]);

        return response()->json([
            'days' => $days,
            'bills' => $bills,
        ]);
    }
}

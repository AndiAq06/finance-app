<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Transaction;
use App\Models\Transfer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = $user->transactions()->with(['account', 'category', 'transferAsSender.toAccount', 'transferAsReceiver.fromAccount']);

        if ($request->filled('account_id')) {
            $query->where('account_id', $request->input('account_id'));
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->input('category_id'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('flow')) {
            $query->where('flow', $request->input('flow'));
        }

        if ($request->filled('start_date')) {
            $query->where('date', '>=', $request->input('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->where('date', '<=', $request->input('end_date'));
        }

        if ($request->filled('q')) {
            $term = '%'.$request->input('q').'%';
            $query->where(function ($q) use ($term) {
                $q->where('description', 'like', $term)
                    ->orWhere('notes', 'like', $term)
                    ->orWhere('counterparty', 'like', $term);
            });
        }

        // Hitung ringkasan sebelum pagination
        $summaryQuery = clone $query;
        $income = (float) (clone $summaryQuery)->where('flow', 'in')->where('type', '!=', 'transfer')->sum('amount');
        $expense = (float) (clone $summaryQuery)->where('flow', 'out')->where('type', '!=', 'transfer')->sum('amount');
        $count = (clone $summaryQuery)->count();
        $net = $income - $expense;

        $perPage = (int) $request->input('per_page', 25);
        $paginator = $query->orderBy('date', 'desc')->orderBy('id', 'desc')->paginate($perPage);

        $data = collect($paginator->items())->map(fn (Transaction $t) => $this->formatTransaction($t));

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'summary' => [
                'income' => number_format($income, 2, '.', ''),
                'expense' => number_format($expense, 2, '.', ''),
                'net' => number_format($net, 2, '.', ''),
                'count' => $count,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        // Transfer antar akun
        if ($request->input('type') === 'transfer') {
            $validated = $request->validate([
                'from_account_id' => 'required|exists:accounts,id',
                'to_account_id' => 'required|exists:accounts,id|different:from_account_id',
                'amount' => 'required|numeric|min:0.01',
                'date' => 'required|date',
                'notes' => 'nullable|string|max:500',
            ]);

            $fromAcc = $user->accounts()->findOrFail($validated['from_account_id']);
            $toAcc = $user->accounts()->findOrFail($validated['to_account_id']);

            $amount = number_format((float) $validated['amount'], 2, '.', '');

            $result = DB::transaction(function () use ($user, $fromAcc, $toAcc, $amount, $validated) {
                $outTx = Transaction::create([
                    'user_id' => $user->id,
                    'account_id' => $fromAcc->id,
                    'category_id' => null,
                    'type' => 'transfer',
                    'flow' => 'out',
                    'date' => $validated['date'],
                    'amount' => $amount,
                    'description' => "Transfer ke {$toAcc->name}",
                    'notes' => $validated['notes'] ?? null,
                ]);

                $inTx = Transaction::create([
                    'user_id' => $user->id,
                    'account_id' => $toAcc->id,
                    'category_id' => null,
                    'type' => 'transfer',
                    'flow' => 'in',
                    'date' => $validated['date'],
                    'amount' => $amount,
                    'description' => "Transfer dari {$fromAcc->name}",
                    'notes' => $validated['notes'] ?? null,
                ]);

                Transfer::create([
                    'user_id' => $user->id,
                    'from_account_id' => $fromAcc->id,
                    'to_account_id' => $toAcc->id,
                    'from_transaction_id' => $outTx->id,
                    'to_transaction_id' => $inTx->id,
                ]);

                return $outTx;
            });

            return response()->json(['data' => $this->formatTransaction($result->fresh(['account', 'category', 'transferAsSender.toAccount']))], 201);
        }

        // Transaksi reguler
        $validated = $request->validate([
            'account_id' => 'required|exists:accounts,id',
            'category_id' => 'nullable|exists:categories,id',
            'type' => 'required|in:income,expense,debt,adjustment',
            'flow' => 'nullable|in:in,out',
            'date' => 'required|date',
            'amount' => 'required|numeric|min:0.01',
            'description' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
            'counterparty' => 'nullable|string|max:100',
        ]);

        $flow = $validated['flow'] ?? ($validated['type'] === 'income' ? 'in' : 'out');

        $tx = $user->transactions()->create([
            'account_id' => $validated['account_id'],
            'category_id' => $validated['category_id'] ?? null,
            'type' => $validated['type'],
            'flow' => $flow,
            'date' => $validated['date'],
            'amount' => number_format((float) $validated['amount'], 2, '.', ''),
            'description' => $validated['description'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'counterparty' => $validated['counterparty'] ?? null,
        ]);

        return response()->json(['data' => $this->formatTransaction($tx->fresh(['account', 'category']))], 201);
    }

    public function show(Request $request, $id): JsonResponse
    {
        $tx = $request->user()->transactions()->with(['account', 'category', 'transferAsSender.toAccount', 'transferAsReceiver.fromAccount'])->findOrFail($id);

        return response()->json(['data' => $this->formatTransaction($tx)]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $tx = $user->transactions()->with(['transferAsSender', 'transferAsReceiver'])->findOrFail($id);

        $validated = $request->validate([
            'account_id' => 'sometimes|exists:accounts,id',
            'category_id' => 'nullable|exists:categories,id',
            'date' => 'sometimes|date',
            'amount' => 'sometimes|numeric|min:0.01',
            'description' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
            'counterparty' => 'nullable|string|max:100',
        ]);

        if ($tx->type === 'transfer') {
            // Update nominal & tanggal pada kedua transaksi transfer
            $tr = $tx->transferAsSender ?? $tx->transferAsReceiver;
            if ($tr) {
                $amount = isset($validated['amount']) ? number_format((float) $validated['amount'], 2, '.', '') : null;
                $updateData = array_filter([
                    'date' => $validated['date'] ?? null,
                    'amount' => $amount,
                    'notes' => $validated['notes'] ?? null,
                ]);

                if (! empty($updateData)) {
                    $tr->fromTransaction()->update($updateData);
                    $tr->toTransaction()->update($updateData);
                }
            }
        } else {
            if (isset($validated['amount'])) {
                $validated['amount'] = number_format((float) $validated['amount'], 2, '.', '');
            }
            $tx->update($validated);
        }

        return response()->json(['data' => $this->formatTransaction($tx->fresh(['account', 'category', 'transferAsSender.toAccount', 'transferAsReceiver.fromAccount']))]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $tx = $user->transactions()->with(['transferAsSender', 'transferAsReceiver'])->findOrFail($id);

        DB::transaction(function () use ($tx) {
            $tr = $tx->transferAsSender ?? $tx->transferAsReceiver;
            if ($tr) {
                // Hapus transfer dan kedua transaksi
                $fromTxId = $tr->from_transaction_id;
                $toTxId = $tr->to_transaction_id;
                $tr->delete();
                Transaction::whereIn('id', [$fromTxId, $toTxId])->delete();
            } else {
                $tx->delete();
            }
        });

        return response()->json(['message' => 'Transaksi berhasil dihapus.']);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $user = $request->user();
        $query = $user->transactions()->with(['account', 'category']);

        if ($request->filled('account_id')) {
            $query->where('account_id', $request->input('account_id'));
        }
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->input('category_id'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }
        if ($request->filled('flow')) {
            $query->where('flow', $request->input('flow'));
        }
        if ($request->filled('start_date')) {
            $query->where('date', '>=', $request->input('start_date'));
        }
        if ($request->filled('end_date')) {
            $query->where('date', '<=', $request->input('end_date'));
        }

        $transactions = $query->orderBy('date', 'desc')->orderBy('id', 'desc')->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="finora_transaksi_' . date('Ymd_His') . '.csv"',
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        $callback = function () use ($transactions) {
            $file = fopen('php://output', 'w');
            fputs($file, "\xEF\xBB\xBF"); // UTF-8 BOM
            fputcsv($file, ['ID', 'Tanggal', 'Tipe', 'Arus', 'Akun', 'Kategori', 'Nominal', 'Deskripsi', 'Pihak Lain', 'Catatan']);

            foreach ($transactions as $t) {
                fputcsv($file, [
                    $t->id,
                    $t->date ? $t->date->format('Y-m-d') : '',
                    $t->type,
                    $t->flow === 'in' ? 'Masuk' : 'Keluar',
                    $t->account?->name ?? '',
                    $t->category?->name ?? '',
                    $t->amount,
                    $t->description ?? '',
                    $t->counterparty ?? '',
                    $t->notes ?? '',
                ]);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function importCsv(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:5120',
            'default_account_id' => 'required|exists:accounts,id',
        ]);

        $user = $request->user();
        $defaultAccount = $user->accounts()->findOrFail($request->input('default_account_id'));

        $file = $request->file('file');
        $path = $file->getRealPath();
        $handle = fopen($path, 'r');
        if (! $handle) {
            return response()->json(['message' => 'Gagal membuka file CSV.'], 422);
        }

        $header = fgetcsv($handle, 1000, ',');
        if (! $header) {
            fclose($handle);
            return response()->json(['message' => 'File CSV kosong atau tidak valid.'], 422);
        }

        // Clean UTF-8 BOM
        $header[0] = preg_replace('/[\x00-\x1F\x80-\xFF]/', '', $header[0]);
        $headerMap = array_map(fn ($h) => strtolower(trim($h)), $header);

        $dateCol = array_search('tanggal', $headerMap);
        if ($dateCol === false) {
            $dateCol = array_search('date', $headerMap);
        }

        $amountCol = array_search('nominal', $headerMap);
        if ($amountCol === false) {
            $amountCol = array_search('amount', $headerMap);
        }

        $typeCol = array_search('tipe', $headerMap);
        if ($typeCol === false) {
            $typeCol = array_search('type', $headerMap);
        }

        $flowCol = array_search('arus', $headerMap);
        if ($flowCol === false) {
            $flowCol = array_search('flow', $headerMap);
        }

        $descCol = array_search('deskripsi', $headerMap);
        if ($descCol === false) {
            $descCol = array_search('description', $headerMap);
        }

        $catCol = array_search('kategori', $headerMap);
        if ($catCol === false) {
            $catCol = array_search('category', $headerMap);
        }

        $notesCol = array_search('catatan', $headerMap);
        if ($notesCol === false) {
            $notesCol = array_search('notes', $headerMap);
        }

        $categories = $user->categories()->get()->keyBy(fn ($c) => strtolower(trim($c->name)));
        $importedCount = 0;

        DB::beginTransaction();
        try {
            while (($row = fgetcsv($handle, 1000, ',')) !== false) {
                if (empty(array_filter($row))) {
                    continue;
                }

                $amountVal = $amountCol !== false && isset($row[$amountCol])
                    ? (float) preg_replace('/[^0-9.]/', '', str_replace(',', '.', $row[$amountCol]))
                    : 0;

                if ($amountVal <= 0) {
                    continue;
                }

                $dateStr = $dateCol !== false && isset($row[$dateCol]) ? trim($row[$dateCol]) : date('Y-m-d');
                $timestamp = strtotime($dateStr);
                $finalDate = $timestamp ? date('Y-m-d', $timestamp) : date('Y-m-d');

                $rawType = $typeCol !== false && isset($row[$typeCol]) ? strtolower(trim($row[$typeCol])) : '';
                $rawFlow = $flowCol !== false && isset($row[$flowCol]) ? strtolower(trim($row[$flowCol])) : '';

                $type = 'expense';
                $flow = 'out';
                if ($rawType === 'income' || $rawFlow === 'masuk' || $rawFlow === 'in') {
                    $type = 'income';
                    $flow = 'in';
                }

                $catName = $catCol !== false && isset($row[$catCol]) ? strtolower(trim($row[$catCol])) : '';
                $category = $categories[$catName] ?? null;

                $desc = $descCol !== false && isset($row[$descCol]) ? trim($row[$descCol]) : 'Import CSV';
                $notes = $notesCol !== false && isset($row[$notesCol]) ? trim($row[$notesCol]) : null;

                Transaction::create([
                    'user_id' => $user->id,
                    'account_id' => $defaultAccount->id,
                    'category_id' => $category?->id,
                    'type' => $type,
                    'flow' => $flow,
                    'date' => $finalDate,
                    'amount' => number_format($amountVal, 2, '.', ''),
                    'description' => $desc,
                    'notes' => $notes,
                ]);

                $importedCount++;
            }
            DB::commit();
            fclose($handle);
        } catch (\Throwable $e) {
            DB::rollBack();
            fclose($handle);

            return response()->json(['message' => 'Gagal mengimpor file: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'message' => "Berhasil mengimpor {$importedCount} transaksi.",
            'imported_count' => $importedCount,
        ]);
    }

    public function uploadAttachment(Request $request, $id): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ]);

        $user = $request->user();
        $tx = $user->transactions()->findOrFail($id);

        $file = $request->file('file');
        $originalName = $file->getClientOriginalName();
        $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('attachments', $filename, 'public');

        $tx->update([
            'has_attachment' => true,
            'attachment_name' => $originalName,
            'attachment_path' => '/storage/' . $path,
        ]);

        return response()->json([
            'message' => 'Lampiran struk berhasil diunggah.',
            'data' => $this->formatTransaction($tx->fresh(['account', 'category'])),
        ]);
    }

    protected function formatTransaction(Transaction $t): array
    {
        $transferData = null;
        if ($t->type === 'transfer') {
            $sender = $t->transferAsSender;
            $receiver = $t->transferAsReceiver;
            $tr = $sender ?? $receiver;
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
            'account' => $t->account ? [
                'id' => $t->account->id,
                'name' => $t->account->name,
                'color' => $t->account->color,
                'icon' => $t->account->icon,
                'type' => $t->account->type,
            ] : null,
            'category' => $t->category ? [
                'id' => $t->category->id,
                'name' => $t->category->name,
                'color' => $t->category->color,
                'icon' => $t->category->icon,
                'type' => $t->category->type,
            ] : null,
            'transfer' => $transferData,
            'has_attachment' => (bool) $t->has_attachment,
            'attachment_name' => $t->attachment_name,
            'attachment_url' => $t->attachment_path ? url($t->attachment_path) : null,
            'recurring_id' => $t->recurring_id,
            'debt_id' => $t->debt_id,
            'bill_id' => $t->bill_id,
            'locked_reason' => $t->locked_reason,
            'created_at' => $t->created_at ? $t->created_at->toISOString() : null,
        ];
    }
}

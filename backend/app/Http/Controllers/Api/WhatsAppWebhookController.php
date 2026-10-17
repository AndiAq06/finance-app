<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\User;
use App\Services\FinanceChatParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhatsAppWebhookController extends Controller
{
    protected FinanceChatParser $parser;

    public function __construct(FinanceChatParser $parser)
    {
        $this->parser = $parser;
    }

    /**
     * Webhook verification untuk WhatsApp Cloud API (Meta).
     */
    public function verify(Request $request)
    {
        $mode = $request->query('hub_mode');
        $token = $request->query('hub_verify_token');
        $challenge = $request->query('hub_challenge');

        $verifyToken = config('services.whatsapp.verify_token', 'finora_secret_token_123');

        if ($mode === 'subscribe' && $token === $verifyToken) {
            return response($challenge, 200)->header('Content-Type', 'text/plain');
        }

        return response()->json(['message' => 'Verification failed'], 403);
    }

    /**
     * Menerima pesan masuk dari WhatsApp Gateway (Fonnte, Wablas, Meta, dll).
     */
    public function handle(Request $request): JsonResponse
    {
        // 1. Ekstrak pesan dan nomor pengirim dari berbagai format gateway
        $message = '';
        $senderPhone = '';

        // Format Fonnte: 'message' dan 'sender'
        if ($request->filled('message') && $request->filled('sender')) {
            $message = (string) $request->input('message');
            $senderPhone = (string) $request->input('sender');
        }
        // Format Wablas: 'message' dan 'phone'
        elseif ($request->filled('message') && $request->filled('phone')) {
            $message = (string) $request->input('message');
            $senderPhone = (string) $request->input('phone');
        }
        // Format Meta WhatsApp Cloud API
        elseif ($request->has('entry')) {
            $entry = $request->input('entry.0.changes.0.value.messages.0');
            if ($entry) {
                $message = $entry['text']['body'] ?? '';
                $senderPhone = $entry['from'] ?? '';
            }
        }
        // Generic JSON payload
        else {
            $message = (string) $request->input('text', $request->input('message', ''));
            $senderPhone = (string) $request->input('phone', $request->input('sender', ''));
        }

        if (empty(trim($message))) {
            return response()->json(['status' => 'ignored', 'message' => 'Pesan kosong'], 200);
        }

        // 2. Temukan User Finora berdasarkan nomor HP
        $cleanPhone = preg_replace('/[^0-9]/', '', $senderPhone);
        $user = null;

        if (! empty($cleanPhone)) {
            // Cocokkan nomor HP dengan awalan 62 / 08
            $var1 = $cleanPhone;
            $var2 = str_starts_with($cleanPhone, '62') ? '0'.substr($cleanPhone, 2) : ('62'.substr($cleanPhone, 1));

            $user = User::where('phone', $var1)->orWhere('phone', $var2)->first();
        }

        // Jika nomor HP belum didaftarkan di akun, pilih user demo atau user pertama
        if (! $user) {
            $user = User::where('is_demo', true)->first() ?? User::first();
        }

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'reply' => '⚠️ Akun Finora tidak ditemukan. Silakan hubungkan nomor Anda di pengaturan Finora.',
            ], 200);
        }

        // 3. Parse Pesan dengan FinanceChatParser
        $parsed = $this->parser->parse($message, $user);

        // Command: Saldo
        if (! empty($parsed['is_command']) && $parsed['command'] === 'saldo') {
            $accounts = $user->accounts()->where('is_active', true)->get();
            $reply = "📊 *RINGKASAN SALDO FINORA*\n";
            $reply .= "Halo, {$user->name}!\n\n";
            $totalSaldo = 0;

            foreach ($accounts as $acc) {
                $bal = (float) $acc->balance;
                $totalSaldo += $bal;
                $reply .= "• {$acc->name}: Rp " . number_format($bal, 0, ',', '.') . "\n";
            }

            $reply .= "\n*Total Saldo:* Rp " . number_format($totalSaldo, 0, ',', '.') . "\n";
            $reply .= "━━━━━━━━━━━━━━━\n";
            $reply .= "Ketik misalnya: _\"pengeluaran 30000 makan malam\"_ untuk mencatat transaksi.";

            return response()->json([
                'status' => 'success',
                'reply' => $reply,
            ]);
        }

        // Command: Bantuan
        if (! empty($parsed['is_command']) && $parsed['command'] === 'help') {
            $reply = "💡 *PANDUAN CHAT BOT FINORA*\n\n";
            $reply .= "Anda bisa mencatat transaksi dengan mengetik pesan santai:\n\n";
            $reply .= "1️⃣ *Pengeluaran:*\n";
            $reply .= "• _\"pengeluaran 30000 makan malam\"_\n";
            $reply .= "• _\"beli bensin 50rb bca\"_\n";
            $reply .= "• _\"kopi kenangan 25k gopay\"_\n\n";
            $reply .= "2️⃣ *Pemasukan:*\n";
            $reply .= "• _\"gaji 8jt masuk mandiri\"_\n";
            $reply .= "• _\"dapat transfer 150rb\"_\n\n";
            $reply .= "3️⃣ *Cek Saldo:*\n";
            $reply .= "• Ketik _\"saldo\"_";

            return response()->json([
                'status' => 'success',
                'reply' => $reply,
            ]);
        }

        // Validasi apakah nominal terdeteksi
        if (empty($parsed['amount']) || $parsed['amount'] <= 0) {
            $reply = "⚠️ Nominal uang tidak terdeteksi dalam pesan Anda.\n\n";
            $reply .= "Contoh format penulisan:\n";
            $reply .= "👉 _\"pengeluaran 30000 makan malam\"_\n";
            $reply .= "👉 _\"beli bensin 50rb bca\"_";

            return response()->json([
                'status' => 'unrecognized',
                'reply' => $reply,
            ]);
        }

        $account = $parsed['account'];
        if (! $account) {
            return response()->json([
                'status' => 'error',
                'reply' => '⚠️ Tidak ada rekening aktif yang ditemukan di akun Finora Anda.',
            ]);
        }

        // 4. Simpan Transaksi Otomatis ke Database
        $tx = Transaction::create([
            'user_id' => $user->id,
            'account_id' => $account->id,
            'category_id' => $parsed['category']?->id,
            'type' => $parsed['type'],
            'flow' => $parsed['flow'],
            'date' => date('Y-m-d'),
            'amount' => number_format((float) $parsed['amount'], 2, '.', ''),
            'description' => $parsed['description'],
            'notes' => 'Dicatat otomatis via WhatsApp Chat',
        ]);

        // Hitung saldo rekening terbaru
        $freshAccount = $account->fresh();
        $formattedAmount = 'Rp ' . number_format($parsed['amount'], 0, ',', '.');
        $formattedBalance = 'Rp ' . number_format((float) $freshAccount->balance, 0, ',', '.');
        $isExpense = $parsed['type'] === 'expense';

        // 5. Format Balasan WhatsApp
        $reply = "✅ *TRANSAKSI BERHASIL DICATAT*\n";
        $reply .= "━━━━━━━━━━━━━━━\n";
        $reply .= ($isExpense ? "💸 *Pengeluaran:* " : "💰 *Pemasukan:* ") . "{$formattedAmount}\n";
        $reply .= "📝 *Keterangan:* {$parsed['description']}\n";
        if ($parsed['category']) {
            $reply .= "🏷️ *Kategori:* {$parsed['category']->name}\n";
        }
        $reply .= "🏦 *Rekening:* {$account->name}\n";
        $reply .= "📅 *Tanggal:* " . date('d M Y') . "\n";
        $reply .= "━━━━━━━━━━━━━━━\n";
        $reply .= "💼 *Sisa Saldo {$account->name}:* {$formattedBalance}\n\n";
        $reply .= "Lihat detail di web Finora Anda.";

        return response()->json([
            'status' => 'success',
            'reply' => $reply,
            'data' => [
                'transaction_id' => $tx->id,
                'amount' => $parsed['amount'],
                'type' => $parsed['type'],
                'account' => $account->name,
                'category' => $parsed['category']?->name,
            ],
        ]);
    }
}

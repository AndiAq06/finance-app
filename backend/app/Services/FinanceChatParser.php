<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Category;
use App\Models\User;

class FinanceChatParser
{
    /**
     * Parse text message and extract transaction attributes.
     */
    public function parse(string $message, User $user): array
    {
        $raw = trim($message);
        $lower = strtolower($raw);

        // Command: Cek Saldo
        if (in_array($lower, ['saldo', 'cek saldo', 'info saldo', 'balance', 'dompet'])) {
            return [
                'is_command' => true,
                'command' => 'saldo',
            ];
        }

        // Command: Bantuan
        if (in_array($lower, ['bantuan', 'help', 'menu', 'panduan'])) {
            return [
                'is_command' => true,
                'command' => 'help',
            ];
        }

        // 1. Ekstrak Nominal Uang
        // Mendukung: 30000, 30.000, 30rb, 30 ribu, 30k, 1.5jt, 1,5 juta, rp 30000, rp. 30.000
        $amount = 0.0;
        $matchedNominalString = '';

        if (preg_match('/(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(jt|juta|m|miliar|rb|ribu|k)?\b/i', $lower, $matches)) {
            $matchedNominalString = $matches[0];
            $numVal = (float) str_replace(',', '.', str_replace('.', '', $matches[1]));
            $unit = strtolower($matches[2] ?? '');

            if (in_array($unit, ['jt', 'juta', 'm'])) {
                $amount = $numVal * 1000000;
            } elseif (in_array($unit, ['rb', 'ribu', 'k'])) {
                $amount = $numVal * 1000;
            } else {
                // Jika angka polos tanpa unit (mis. 30000 atau 30.000)
                // Cek apakah format ribuan Indonesia misal 30.000
                $cleanDigits = preg_replace('/[^0-9]/', '', $matches[1]);
                $amount = (float) $cleanDigits;
            }
        }

        // 2. Tentukan Tipe & Arus (Income vs Expense)
        $isIncome = false;
        $incomeKeywords = ['pemasukan', 'masuk', 'gaji', 'terima', 'dapat', 'bonus', 'transfer masuk', 'cair'];
        foreach ($incomeKeywords as $ik) {
            if (str_contains($lower, $ik)) {
                $isIncome = true;
                break;
            }
        }

        $type = $isIncome ? 'income' : 'expense';
        $flow = $isIncome ? 'in' : 'out';

        // 3. Cocokkan Akun / Rekening
        $accounts = $user->accounts()->where('is_active', true)->get();
        $selectedAccount = null;
        foreach ($accounts as $acc) {
            $accName = strtolower($acc->name);
            if (str_contains($lower, $accName) || ($accName === 'bca' && str_contains($lower, 'bca'))) {
                $selectedAccount = $acc;
                break;
            }
        }
        // Fallback ke akun pertama jika tidak disebut
        if (! $selectedAccount && $accounts->isNotEmpty()) {
            $selectedAccount = $accounts->first();
        }

        // 4. Cocokkan Kategori
        $categories = $user->categories()->where('type', $type)->get();
        $selectedCategory = null;

        // Keyword dictionary untuk kategori populer Indonesia
        $categoryKeywords = [
            'makanan' => ['makan', 'malam', 'siang', 'pagi', 'sarapan', 'dinner', 'lunch', 'kopi', 'kafe', 'resto', 'jajan', 'snack', 'food', 'minum'],
            'transportasi' => ['bensin', 'pertalite', 'pertamax', 'solar', 'parkir', 'tol', 'gojek', 'grab', 'ojol', 'service', 'cuci'],
            'belanja' => ['belanja', 'supermarket', 'pasar', 'indomaret', 'alfamart', 'shopee', 'tokopedia', 'baju', 'kaos'],
            'tagihan' => ['listrik', 'pln', 'pdam', 'air', 'wifi', 'internet', 'pulsa', 'kuota', 'kontrakan', 'sewa', 'bpjs'],
            'hiburan' => ['nonton', 'bioskop', 'game', 'steam', 'netflix', 'spotify', 'jalan-jalan', 'liburan'],
            'gaji' => ['gaji', 'payroll', 'salary', 'honor', 'upah'],
            'investasi' => ['dividen', 'reksadana', 'saham', 'crypto', 'bunga'],
        ];

        foreach ($categories as $cat) {
            $catLower = strtolower($cat->name);
            // Cek nama kategori langsung
            if (str_contains($lower, $catLower)) {
                $selectedCategory = $cat;
                break;
            }
            // Cek sinonim/kamus
            foreach ($categoryKeywords as $keywordGroup => $words) {
                if (str_contains($catLower, $keywordGroup)) {
                    foreach ($words as $w) {
                        if (preg_match('/\b'.preg_quote($w, '/').'\b/i', $lower)) {
                            $selectedCategory = $cat;
                            break 2;
                        }
                    }
                }
            }
        }

        // Fallback jika belum ketemu kategori
        if (! $selectedCategory && $categories->isNotEmpty()) {
            $selectedCategory = $categories->first();
        }

        // 5. Bersihkan Deskripsi
        // Buang kata nominal, kata pengeluaran/pemasukan, dan kata rekening dari kalimat
        $cleanDesc = $raw;
        if ($matchedNominalString) {
            $cleanDesc = str_ireplace($matchedNominalString, '', $cleanDesc);
        }
        $removeWords = ['pengeluaran', 'pemasukan', 'sebesar', 'seharga', 'senilai', 'beli', 'bayar', 'buat', 'untuk', 'pake', 'pakai', 'lewat', 'dari', 'ke'];
        if ($selectedAccount) {
            $removeWords[] = strtolower($selectedAccount->name);
        }
        foreach ($removeWords as $rw) {
            $cleanDesc = preg_replace('/\b'.preg_quote($rw, '/').'\b/i', '', $cleanDesc);
        }
        $cleanDesc = trim(preg_replace('/\s+/', ' ', $cleanDesc));
        if (empty($cleanDesc)) {
            $cleanDesc = $selectedCategory ? $selectedCategory->name : ($isIncome ? 'Pemasukan' : 'Pengeluaran');
        }

        return [
            'is_command' => false,
            'amount' => $amount,
            'type' => $type,
            'flow' => $flow,
            'account' => $selectedAccount,
            'category' => $selectedCategory,
            'description' => ucfirst($cleanDesc),
        ];
    }
}

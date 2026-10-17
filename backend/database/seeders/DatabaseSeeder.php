<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\AppNotification;
use App\Models\Bill;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Preference;
use App\Models\Recurring;
use App\Models\SavingsContribution;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use App\Models\Transfer;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Demo User
        $user = User::updateOrCreate(
            ['email' => 'demo@finora.test'],
            [
                'name' => 'Budi Santoso',
                'password' => Hash::make('password'),
                'is_demo' => true,
            ]
        );

        // 2. Preferences
        Preference::updateOrCreate(
            ['user_id' => $user->id],
            [
                'currency' => 'IDR',
                'locale' => 'id',
                'timezone' => 'Asia/Jakarta',
                'date_format' => 'd MMM yyyy',
                'theme' => 'light',
                'week_starts_on' => 1,
                'notify_transaction' => true,
                'notify_budget' => true,
                'notify_bill' => true,
                'notify_goal' => true,
                'notify_debt' => true,
                'bill_reminder_days' => 3,
                'hide_sensitive_in_notifications' => false,
            ]
        );

        // 3. Accounts
        $accBCA = Account::create([
            'user_id' => $user->id,
            'name' => 'BCA Tahapan Utama',
            'type' => 'bank',
            'opening_balance' => '12000000.00',
            'start_date' => Carbon::now()->subMonths(6)->toDateString(),
            'color' => '#0EA5E9',
            'icon' => 'landmark',
            'is_active' => true,
            'notes' => 'Rekening payroll dan transaksi utama',
        ]);

        $accMandiri = Account::create([
            'user_id' => $user->id,
            'name' => 'Bank Mandiri',
            'type' => 'bank',
            'opening_balance' => '6500000.00',
            'start_date' => Carbon::now()->subMonths(6)->toDateString(),
            'color' => '#6366F1',
            'icon' => 'building',
            'is_active' => true,
            'notes' => 'Tabungan operasional dan bisnis',
        ]);

        $accGopay = Account::create([
            'user_id' => $user->id,
            'name' => 'GoPay / e-Wallet',
            'type' => 'ewallet',
            'opening_balance' => '750000.00',
            'start_date' => Carbon::now()->subMonths(6)->toDateString(),
            'color' => '#14B8A6',
            'icon' => 'smartphone',
            'is_active' => true,
            'notes' => 'Pembayaran harian dan QRIS',
        ]);

        $accCash = Account::create([
            'user_id' => $user->id,
            'name' => 'Dompet Tunai',
            'type' => 'cash',
            'opening_balance' => '500000.00',
            'start_date' => Carbon::now()->subMonths(6)->toDateString(),
            'color' => '#16A34A',
            'icon' => 'wallet',
            'is_active' => true,
            'notes' => 'Uang tunai di saku / dompet',
        ]);

        $accSavings = Account::create([
            'user_id' => $user->id,
            'name' => 'Bibit Reksadana & Tabungan',
            'type' => 'savings',
            'opening_balance' => '20000000.00',
            'start_date' => Carbon::now()->subMonths(6)->toDateString(),
            'color' => '#8B5CF6',
            'icon' => 'piggy-bank',
            'is_active' => true,
            'notes' => 'Portofolio investasi pasar uang',
        ]);

        // 4. Categories
        $incomeCategories = [
            ['name' => 'Gaji & Upah', 'type' => 'income', 'icon' => 'banknote', 'color' => '#16A34A'],
            ['name' => 'Bisnis & Freelance', 'type' => 'income', 'icon' => 'briefcase', 'color' => '#0EA5E9'],
            ['name' => 'Investasi & Bunga', 'type' => 'income', 'icon' => 'trending-up', 'color' => '#8B5CF6'],
            ['name' => 'Bonus & THR', 'type' => 'income', 'icon' => 'gift', 'color' => '#EC4899'],
        ];

        $expenseCategories = [
            ['name' => 'Makanan & Minuman', 'type' => 'expense', 'icon' => 'utensils', 'color' => '#F97316'],
            ['name' => 'Transportasi', 'type' => 'expense', 'icon' => 'car', 'color' => '#0EA5E9'],
            ['name' => 'Belanja Kebutuhan', 'type' => 'expense', 'icon' => 'shopping-bag', 'color' => '#E11D48'],
            ['name' => 'Tagihan & Utilitas', 'type' => 'expense', 'icon' => 'receipt', 'color' => '#F59E0B'],
            ['name' => 'Tempat Tinggal', 'type' => 'expense', 'icon' => 'home', 'color' => '#6366F1'],
            ['name' => 'Hiburan & Liburan', 'type' => 'expense', 'icon' => 'clapperboard', 'color' => '#8B5CF6'],
            ['name' => 'Kesehatan & Obat', 'type' => 'expense', 'icon' => 'heart-pulse', 'color' => '#EC4899'],
            ['name' => 'Pendidikan & Buku', 'type' => 'expense', 'icon' => 'book-open', 'color' => '#14B8A6'],
        ];

        $cats = [];
        foreach (array_merge($incomeCategories, $expenseCategories) as $c) {
            $cat = Category::create(array_merge($c, ['user_id' => $user->id, 'is_default' => true]));
            $cats[$c['name']] = $cat;
        }

        // 5. Historical Transactions (3 bulan terakhir hingga bulan ini)
        $now = Carbon::now();

        // Gaji bulanan
        for ($m = 3; $m >= 0; $m--) {
            $d = (clone $now)->subMonths($m)->setDay(25);
            if ($d->lte($now)) {
                Transaction::create([
                    'user_id' => $user->id,
                    'account_id' => $accBCA->id,
                    'category_id' => $cats['Gaji & Upah']->id,
                    'type' => 'income',
                    'flow' => 'in',
                    'date' => $d->toDateString(),
                    'amount' => '14500000.00',
                    'description' => 'Gaji Bulanan PT Teknologi Digital',
                ]);
            }
        }

        // Freelance
        Transaction::create([
            'user_id' => $user->id,
            'account_id' => $accMandiri->id,
            'category_id' => $cats['Bisnis & Freelance']->id,
            'type' => 'income',
            'flow' => 'in',
            'date' => (clone $now)->subDays(12)->toDateString(),
            'amount' => '3800000.00',
            'description' => 'Pembayaran Project Web Design Client',
            'counterparty' => 'PT Mitra Sejahtera',
        ]);

        // Pengeluaran Makanan, Belanja, Transportasi
        $sampleExpenses = [
            ['cat' => 'Makanan & Minuman', 'acc' => $accGopay, 'amt' => '85000.00', 'desc' => 'Makan Siang Nasi Padang + Es Teh', 'days' => 1],
            ['cat' => 'Makanan & Minuman', 'acc' => $accCash, 'amt' => '45000.00', 'desc' => 'Kopi Kenangan Mantan', 'days' => 2],
            ['cat' => 'Makanan & Minuman', 'acc' => $accGopay, 'amt' => '120000.00', 'desc' => 'Dinner Sushi Tei', 'days' => 4],
            ['cat' => 'Transportasi', 'acc' => $accGopay, 'amt' => '35000.00', 'desc' => 'Gojek ke Stasiun Sudirman', 'days' => 3],
            ['cat' => 'Transportasi', 'acc' => $accBCA, 'amt' => '250000.00', 'desc' => 'Isi Bensin Pertamax', 'days' => 6],
            ['cat' => 'Belanja Kebutuhan', 'acc' => $accBCA, 'amt' => '625000.00', 'desc' => 'Belanja Bulanan Superindo', 'days' => 7],
            ['cat' => 'Tempat Tinggal', 'acc' => $accBCA, 'amt' => '1800000.00', 'desc' => 'Sewa Kost Bulanan AC + WiFi', 'days' => 15],
            ['cat' => 'Tagihan & Utilitas', 'acc' => $accBCA, 'amt' => '420000.00', 'desc' => 'Tagihan Listrik PLN Pascabayar', 'days' => 14],
            ['cat' => 'Tagihan & Utilitas', 'acc' => $accBCA, 'amt' => '385000.00', 'desc' => 'Paket Internet IndiHome 50 Mbps', 'days' => 16],
            ['cat' => 'Hiburan & Liburan', 'acc' => $accBCA, 'amt' => '186000.00', 'desc' => 'Langganan Netflix Premium Family', 'days' => 18],
            ['cat' => 'Hiburan & Liburan', 'acc' => $accGopay, 'amt' => '130000.00', 'desc' => 'Tiket Bioskop XXI Cinema 21', 'days' => 8],
            ['cat' => 'Kesehatan & Obat', 'acc' => $accBCA, 'amt' => '210000.00', 'desc' => 'Vitamin C & Suplemen Apotek', 'days' => 10],
        ];

        foreach ($sampleExpenses as $e) {
            Transaction::create([
                'user_id' => $user->id,
                'account_id' => $e['acc']->id,
                'category_id' => $cats[$e['cat']]->id,
                'type' => 'expense',
                'flow' => 'out',
                'date' => (clone $now)->subDays($e['days'])->toDateString(),
                'amount' => $e['amt'],
                'description' => $e['desc'],
            ]);
        }

        // Transfer antar akun: Top-up GoPay dari BCA
        $trOut = Transaction::create([
            'user_id' => $user->id,
            'account_id' => $accBCA->id,
            'type' => 'transfer',
            'flow' => 'out',
            'date' => (clone $now)->subDays(5)->toDateString(),
            'amount' => '1000000.00',
            'description' => 'Transfer ke GoPay / e-Wallet',
        ]);
        $trIn = Transaction::create([
            'user_id' => $user->id,
            'account_id' => $accGopay->id,
            'type' => 'transfer',
            'flow' => 'in',
            'date' => (clone $now)->subDays(5)->toDateString(),
            'amount' => '1000000.00',
            'description' => 'Transfer dari BCA Tahapan Utama',
        ]);
        Transfer::create([
            'user_id' => $user->id,
            'from_account_id' => $accBCA->id,
            'to_account_id' => $accGopay->id,
            'from_transaction_id' => $trOut->id,
            'to_transaction_id' => $trIn->id,
        ]);

        // 6. Budgets Bulan Ini
        $currentMonthStr = $now->format('Y-m');
        Budget::create([
            'user_id' => $user->id,
            'category_id' => null,
            'month' => $currentMonthStr,
            'amount' => '9000000.00',
            'is_recurring' => true,
        ]);
        Budget::create([
            'user_id' => $user->id,
            'category_id' => $cats['Makanan & Minuman']->id,
            'month' => $currentMonthStr,
            'amount' => '2500000.00',
            'is_recurring' => true,
        ]);
        Budget::create([
            'user_id' => $user->id,
            'category_id' => $cats['Transportasi']->id,
            'month' => $currentMonthStr,
            'amount' => '1000000.00',
            'is_recurring' => true,
        ]);
        Budget::create([
            'user_id' => $user->id,
            'category_id' => $cats['Belanja Kebutuhan']->id,
            'month' => $currentMonthStr,
            'amount' => '1500000.00',
            'is_recurring' => true,
        ]);
        Budget::create([
            'user_id' => $user->id,
            'category_id' => $cats['Hiburan & Liburan']->id,
            'month' => $currentMonthStr,
            'amount' => '800000.00',
            'is_recurring' => true,
        ]);

        // 7. Savings Goals
        $goal1 = SavingsGoal::create([
            'user_id' => $user->id,
            'account_id' => $accSavings->id,
            'name' => 'Dana Darurat 6 Bulan',
            'target_amount' => '40000000.00',
            'deadline' => (clone $now)->addMonths(14)->toDateString(),
            'icon' => 'shield',
            'color' => '#16A34A',
            'priority' => 1,
            'notes' => 'Disimpan di Reksadana Pasar Uang berisiko rendah',
            'status' => 'active',
        ]);
        SavingsContribution::create([
            'savings_goal_id' => $goal1->id,
            'user_id' => $user->id,
            'type' => 'deposit',
            'amount' => '20000000.00',
            'date' => (clone $now)->subMonths(2)->toDateString(),
            'note' => 'Setoran awal dana darurat',
        ]);

        $goal2 = SavingsGoal::create([
            'user_id' => $user->id,
            'account_id' => $accMandiri->id,
            'name' => 'Liburan ke Jepang',
            'target_amount' => '22000000.00',
            'deadline' => (clone $now)->addMonths(8)->toDateString(),
            'icon' => 'plane',
            'color' => '#EC4899',
            'priority' => 2,
            'notes' => 'Rencana trip musim semi Tokyo & Kyoto',
            'status' => 'active',
        ]);
        SavingsContribution::create([
            'savings_goal_id' => $goal2->id,
            'user_id' => $user->id,
            'type' => 'deposit',
            'amount' => '7500000.00',
            'date' => (clone $now)->subMonths(1)->toDateString(),
            'note' => 'Tabungan dari bonus project',
        ]);

        // 8. Debts & Receivables
        $debt1 = Debt::create([
            'user_id' => $user->id,
            'account_id' => $accBCA->id,
            'type' => 'receivable',
            'party_name' => 'Rian Saputra (Teman Kantor)',
            'amount' => '1500000.00',
            'date' => (clone $now)->subDays(25)->toDateString(),
            'due_date' => (clone $now)->addDays(10)->toDateString(),
            'notes' => 'Pinjaman talangan servis motor',
            'status' => 'partial',
        ]);
        DebtPayment::create([
            'debt_id' => $debt1->id,
            'user_id' => $user->id,
            'account_id' => $accBCA->id,
            'amount' => '500000.00',
            'date' => (clone $now)->subDays(5)->toDateString(),
            'note' => 'Transfer cicilan pertama via BCA',
        ]);

        $debt2 = Debt::create([
            'user_id' => $user->id,
            'account_id' => $accMandiri->id,
            'type' => 'debt',
            'party_name' => 'Toko Elektronik Makmur',
            'amount' => '2800000.00',
            'date' => (clone $now)->subDays(40)->toDateString(),
            'due_date' => (clone $now)->addDays(20)->toDateString(),
            'notes' => 'Cicilan pembelian monitor kerja 4K',
            'status' => 'partial',
        ]);
        DebtPayment::create([
            'debt_id' => $debt2->id,
            'user_id' => $user->id,
            'account_id' => $accMandiri->id,
            'amount' => '1000000.00',
            'date' => (clone $now)->subDays(10)->toDateString(),
            'note' => 'Pembayaran cicilan bulan 1',
        ]);

        // 9. Bills
        Bill::create([
            'user_id' => $user->id,
            'category_id' => $cats['Tagihan & Utilitas']->id,
            'account_id' => $accBCA->id,
            'name' => 'Listrik PLN Pascabayar',
            'amount' => '450000.00',
            'next_due_date' => (clone $now)->addDays(4)->toDateString(),
            'frequency' => 'monthly',
            'reminder_days' => 3,
            'is_active' => true,
            'notes' => 'ID Pelanggan: 538210984712',
        ]);

        Bill::create([
            'user_id' => $user->id,
            'category_id' => $cats['Tagihan & Utilitas']->id,
            'account_id' => $accBCA->id,
            'name' => 'Internet IndiHome Fiber 50M',
            'amount' => '385000.00',
            'next_due_date' => (clone $now)->addDays(9)->toDateString(),
            'frequency' => 'monthly',
            'reminder_days' => 3,
            'is_active' => true,
            'notes' => 'Nomor langganan: 1224859012',
        ]);

        Bill::create([
            'user_id' => $user->id,
            'category_id' => $cats['Hiburan & Liburan']->id,
            'account_id' => $accGopay->id,
            'name' => 'Netflix Premium Family',
            'amount' => '186000.00',
            'next_due_date' => (clone $now)->addDays(12)->toDateString(),
            'frequency' => 'monthly',
            'reminder_days' => 2,
            'is_active' => true,
        ]);

        // 10. Recurring
        Recurring::create([
            'user_id' => $user->id,
            'account_id' => $accBCA->id,
            'category_id' => $cats['Gaji & Upah']->id,
            'type' => 'income',
            'amount' => '14500000.00',
            'description' => 'Gaji Bulanan PT Teknologi Digital',
            'frequency' => 'monthly',
            'interval' => 1,
            'start_date' => (clone $now)->startOfMonth()->setDay(25)->toDateString(),
            'next_run_date' => (clone $now)->startOfMonth()->setDay(25)->toDateString(),
            'is_active' => true,
            'generated_count' => 3,
        ]);

        Recurring::create([
            'user_id' => $user->id,
            'account_id' => $accBCA->id,
            'category_id' => $cats['Tempat Tinggal']->id,
            'type' => 'expense',
            'amount' => '1800000.00',
            'description' => 'Sewa Kost Bulanan AC + WiFi',
            'frequency' => 'monthly',
            'interval' => 1,
            'start_date' => (clone $now)->startOfMonth()->toDateString(),
            'next_run_date' => (clone $now)->addMonth()->startOfMonth()->toDateString(),
            'is_active' => true,
            'generated_count' => 3,
        ]);

        // 11. Initial Notifications
        AppNotification::create([
            'user_id' => $user->id,
            'type' => 'welcome',
            'title' => 'Selamat Datang di Finora!',
            'body' => 'Akun demo Anda siap digunakan. Pantau pengeluaran, capai target tabungan, dan kelola keuangan Anda dengan mudah.',
            'link' => '/',
            'severity' => 'success',
            'read_at' => Carbon::now()->subHours(2),
        ]);

        AppNotification::create([
            'user_id' => $user->id,
            'type' => 'bill_reminder',
            'title' => 'Tagihan Listrik PLN Mendekati Jatuh Tempo',
            'body' => 'Tagihan Listrik PLN sebesar Rp450.000 jatuh tempo dalam 4 hari.',
            'link' => '/bills',
            'severity' => 'warning',
            'read_at' => null,
        ]);
    }
}

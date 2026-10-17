<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('currency', 10)->default('IDR');
            $table->string('locale', 10)->default('id');
            $table->string('timezone', 50)->default('Asia/Jakarta');
            $table->string('date_format', 30)->default('d MMM yyyy');
            $table->enum('theme', ['light', 'dark', 'system'])->default('light');
            $table->unsignedTinyInteger('week_starts_on')->default(1);
            $table->boolean('notify_transaction')->default(true);
            $table->boolean('notify_budget')->default(true);
            $table->boolean('notify_bill')->default(true);
            $table->boolean('notify_goal')->default(true);
            $table->boolean('notify_debt')->default(true);
            $table->unsignedSmallInteger('bill_reminder_days')->default(3);
            $table->boolean('hide_sensitive_in_notifications')->default(false);
            $table->timestamps();
        });

        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->enum('type', ['cash', 'bank', 'ewallet', 'savings', 'other'])->default('cash');
            $table->decimal('opening_balance', 15, 2)->default(0);
            $table->date('start_date');
            $table->string('color', 20)->default('#16A34A');
            $table->string('icon', 50)->default('wallet');
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->enum('type', ['income', 'expense']);
            $table->string('icon', 50)->default('tag');
            $table->string('color', 20)->default('#16A34A');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('recurrings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['income', 'expense']);
            $table->decimal('amount', 15, 2);
            $table->string('description');
            $table->enum('frequency', ['daily', 'weekly', 'monthly', 'yearly']);
            $table->unsignedInteger('interval')->default(1);
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->date('next_run_date')->nullable();
            $table->date('last_run_date')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('generated_count')->default(0);
            $table->timestamps();
        });

        Schema::create('debts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['debt', 'receivable']);
            $table->string('party_name');
            $table->decimal('amount', 15, 2);
            $table->date('date');
            $table->date('due_date')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['unpaid', 'partial', 'paid'])->default('unpaid');
            $table->timestamps();
        });

        Schema::create('bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('account_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->decimal('amount', 15, 2);
            $table->date('next_due_date')->nullable();
            $table->enum('frequency', ['weekly', 'monthly', 'yearly'])->default('monthly');
            $table->unsignedSmallInteger('reminder_days')->default(3);
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['income', 'expense', 'transfer', 'debt', 'adjustment']);
            $table->enum('flow', ['in', 'out']);
            $table->date('date');
            $table->decimal('amount', 15, 2);
            $table->string('description')->nullable();
            $table->text('notes')->nullable();
            $table->string('counterparty')->nullable();
            $table->boolean('has_attachment')->default(false);
            $table->string('attachment_name')->nullable();
            $table->string('attachment_path')->nullable();
            $table->foreignId('recurring_id')->nullable()->constrained('recurrings')->nullOnDelete();
            $table->foreignId('debt_id')->nullable()->constrained('debts')->nullOnDelete();
            $table->foreignId('bill_id')->nullable()->constrained('bills')->nullOnDelete();
            $table->string('locked_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_account_id')->constrained('accounts')->cascadeOnDelete();
            $table->foreignId('to_account_id')->constrained('accounts')->cascadeOnDelete();
            $table->foreignId('from_transaction_id')->constrained('transactions')->cascadeOnDelete();
            $table->foreignId('to_transaction_id')->constrained('transactions')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('month', 7);
            $table->decimal('amount', 15, 2);
            $table->boolean('is_recurring')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'category_id', 'month']);
        });

        Schema::create('savings_goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->decimal('target_amount', 15, 2);
            $table->date('deadline')->nullable();
            $table->string('icon', 50)->default('target');
            $table->string('color', 20)->default('#16A34A');
            $table->unsignedInteger('priority')->default(1);
            $table->text('notes')->nullable();
            $table->enum('status', ['active', 'achieved'])->default('active');
            $table->timestamps();
        });

        Schema::create('savings_contributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('savings_goal_id')->constrained('savings_goals')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['deposit', 'withdrawal']);
            $table->decimal('amount', 15, 2);
            $table->date('date');
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::create('debt_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('debt_id')->constrained('debts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 15, 2);
            $table->date('date');
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::create('bill_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->constrained('bills')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->date('period_due_date');
            $table->date('paid_date');
            $table->decimal('amount', 15, 2);
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 50)->default('info');
            $table->string('title');
            $table->text('body');
            $table->string('link')->nullable();
            $table->enum('severity', ['info', 'success', 'warning', 'danger'])->default('info');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('bill_payments');
        Schema::dropIfExists('debt_payments');
        Schema::dropIfExists('savings_contributions');
        Schema::dropIfExists('savings_goals');
        Schema::dropIfExists('budgets');
        Schema::dropIfExists('transfers');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('bills');
        Schema::dropIfExists('debts');
        Schema::dropIfExists('recurrings');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('accounts');
        Schema::dropIfExists('preferences');
    }
};

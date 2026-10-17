<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DebtController;
use App\Http\Controllers\Api\GoalController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\RecurringController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\WhatsAppWebhookController;
use Illuminate\Support\Facades\Route;

// Public Auth routes
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
});

// WhatsApp Webhook (Fonnte, Wablas, Meta Cloud API)
Route::prefix('webhooks/whatsapp')->group(function () {
    Route::get('/', [WhatsAppWebhookController::class, 'verify']);
    Route::post('/', [WhatsAppWebhookController::class, 'handle']);
});

// Protected routes (Sanctum stateful session or token)
Route::middleware('auth:sanctum')->group(function () {
    // Auth & preferences
    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::put('/preferences', [AuthController::class, 'updatePreferences']);
    });

    // Accounts
    Route::apiResource('accounts', AccountController::class);

    // Categories
    Route::apiResource('categories', CategoryController::class)->except(['show']);

    // Transactions
    Route::get('/transactions/export/csv', [TransactionController::class, 'exportCsv']);
    Route::post('/transactions/import/csv', [TransactionController::class, 'importCsv']);
    Route::post('/transactions/{id}/attachment', [TransactionController::class, 'uploadAttachment']);
    Route::apiResource('transactions', TransactionController::class);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Budgets
    Route::get('/budgets', [BudgetController::class, 'index']);
    Route::post('/budgets', [BudgetController::class, 'store']);
    Route::delete('/budgets/{id}', [BudgetController::class, 'destroy']);

    // Goals
    Route::apiResource('goals', GoalController::class);
    Route::post('/goals/{id}/contribute', [GoalController::class, 'contribute']);

    // Debts & Receivables
    Route::apiResource('debts', DebtController::class);
    Route::post('/debts/{id}/pay', [DebtController::class, 'pay']);

    // Bills
    Route::apiResource('bills', BillController::class);
    Route::post('/bills/{id}/pay', [BillController::class, 'pay']);

    // Recurring
    Route::post('/recurring/run-pending', [RecurringController::class, 'runPending']);
    Route::apiResource('recurring', RecurringController::class)->except(['show']);

    // Reports
    Route::prefix('reports')->group(function () {
        Route::get('/cashflow', [ReportController::class, 'cashflow']);
        Route::get('/summary', [ReportController::class, 'summary']);
        Route::get('/balance-trend', [ReportController::class, 'balanceTrend']);
        Route::get('/comparison', [ReportController::class, 'comparison']);
    });

    // Calendar
    Route::get('/calendar', [CalendarController::class, 'index']);

    // Search
    Route::get('/search', [SearchController::class, 'index']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
});

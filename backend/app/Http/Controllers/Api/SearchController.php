<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $q = trim((string) $request->input('q', ''));

        if (strlen($q) < 2) {
            return response()->json([
                'transactions' => [],
                'accounts' => [],
                'categories' => [],
                'goals' => [],
                'bills' => [],
                'debts' => [],
            ]);
        }

        $term = "%{$q}%";

        $transactions = $user->transactions()
            ->with(['account', 'category'])
            ->where(function ($sub) use ($term) {
                $sub->where('description', 'like', $term)
                    ->orWhere('notes', 'like', $term)
                    ->orWhere('counterparty', 'like', $term);
            })
            ->orderBy('date', 'desc')
            ->take(15)
            ->get()
            ->map(fn ($t) => [
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
                'account' => $t->account ? ['id' => $t->account->id, 'name' => $t->account->name, 'color' => $t->account->color, 'icon' => $t->account->icon, 'type' => $t->account->type] : null,
                'category' => $t->category ? ['id' => $t->category->id, 'name' => $t->category->name, 'color' => $t->category->color, 'icon' => $t->category->icon, 'type' => $t->category->type] : null,
                'transfer' => null,
                'has_attachment' => (bool) $t->has_attachment,
                'attachment_name' => $t->attachment_name,
                'recurring_id' => $t->recurring_id,
                'debt_id' => $t->debt_id,
                'bill_id' => $t->bill_id,
                'locked_reason' => $t->locked_reason,
                'created_at' => $t->created_at ? $t->created_at->toISOString() : null,
            ]);

        $accounts = $user->accounts()
            ->where('name', 'like', $term)
            ->take(5)
            ->get()
            ->map(fn ($a) => [
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
            ]);

        $categories = $user->categories()
            ->where('name', 'like', $term)
            ->take(5)
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'type' => $c->type,
                'icon' => $c->icon,
                'color' => $c->color,
                'is_default' => (bool) $c->is_default,
            ]);

        $goals = $user->savingsGoals()
            ->where('name', 'like', $term)
            ->take(5)
            ->get()
            ->map(fn ($g) => [
                'id' => $g->id,
                'name' => $g->name,
                'target_amount' => (string) $g->target_amount,
                'saved_amount' => (string) $g->saved_amount,
                'remaining' => (string) max(0, (float) $g->target_amount - (float) $g->saved_amount),
                'percent' => (float) $g->target_amount > 0 ? round((((float) $g->saved_amount) / ((float) $g->target_amount)) * 100, 1) : 0,
                'deadline' => $g->deadline ? $g->deadline->format('Y-m-d') : null,
                'icon' => $g->icon,
                'color' => $g->color,
                'priority' => (int) $g->priority,
                'account_id' => $g->account_id,
                'account' => null,
                'notes' => $g->notes,
                'status' => $g->status,
                'required_per_month' => null,
                'required_per_week' => null,
                'months_left' => null,
            ]);

        $bills = $user->bills()
            ->where('name', 'like', $term)
            ->take(5)
            ->get()
            ->map(fn ($b) => [
                'id' => $b->id,
                'name' => $b->name,
                'amount' => (string) $b->amount,
                'category_id' => $b->category_id,
                'category' => null,
                'account_id' => $b->account_id,
                'account' => null,
                'next_due_date' => $b->next_due_date ? $b->next_due_date->format('Y-m-d') : null,
                'frequency' => $b->frequency,
                'reminder_days' => (int) $b->reminder_days,
                'notes' => $b->notes,
                'is_active' => (bool) $b->is_active,
                'status' => $b->status,
                'days_until_due' => $b->days_until_due,
                'last_paid_date' => $b->last_paid_date,
            ]);

        $debts = $user->debts()
            ->where(function ($s) use ($term) {
                $s->where('party_name', 'like', $term)->orWhere('notes', 'like', $term);
            })
            ->take(5)
            ->get()
            ->map(fn ($d) => [
                'id' => $d->id,
                'type' => $d->type,
                'party_name' => $d->party_name,
                'amount' => (string) $d->amount,
                'paid_amount' => (string) $d->paid_amount,
                'remaining' => (string) $d->remaining,
                'date' => $d->date ? $d->date->format('Y-m-d') : null,
                'due_date' => $d->due_date ? $d->due_date->format('Y-m-d') : null,
                'notes' => $d->notes,
                'status' => $d->status,
                'account_id' => $d->account_id,
                'is_overdue' => $d->is_overdue,
            ]);

        return response()->json([
            'transactions' => $transactions,
            'accounts' => $accounts,
            'categories' => $categories,
            'goals' => $goals,
            'bills' => $bills,
            'debts' => $debts,
        ]);
    }
}

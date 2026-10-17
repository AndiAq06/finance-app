<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bill extends Model
{
    protected $fillable = [
        'user_id',
        'category_id',
        'account_id',
        'name',
        'amount',
        'next_due_date',
        'frequency',
        'reminder_days',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'amount' => 'string',
        'next_due_date' => 'date:Y-m-d',
        'reminder_days' => 'integer',
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(BillPayment::class);
    }

    public function getStatusAttribute(): string
    {
        if (! $this->next_due_date) {
            return 'paid';
        }

        $due = Carbon::parse($this->next_due_date)->startOfDay();
        $today = Carbon::today();

        if ($due->isPast()) {
            return 'overdue';
        }

        return 'unpaid';
    }

    public function getDaysUntilDueAttribute(): ?int
    {
        if (! $this->next_due_date) {
            return null;
        }

        return (int) Carbon::today()->diffInDays(Carbon::parse($this->next_due_date), false);
    }

    public function getLastPaidDateAttribute(): ?string
    {
        $last = $this->payments()->latest('paid_date')->first();
        return $last?->paid_date?->format('Y-m-d');
    }
}

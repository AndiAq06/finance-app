<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Debt extends Model
{
    protected $fillable = [
        'user_id',
        'account_id',
        'type',
        'party_name',
        'amount',
        'date',
        'due_date',
        'notes',
        'status',
    ];

    protected $casts = [
        'amount' => 'string',
        'date' => 'date:Y-m-d',
        'due_date' => 'date:Y-m-d',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(DebtPayment::class);
    }

    public function getPaidAmountAttribute(): string
    {
        $paid = (float) $this->payments()->sum('amount');
        return number_format($paid, 2, '.', '');
    }

    public function getRemainingAttribute(): string
    {
        $rem = max(0, (float) $this->amount - (float) $this->paid_amount);
        return number_format($rem, 2, '.', '');
    }

    public function getIsOverdueAttribute(): bool
    {
        if ($this->status === 'paid' || ! $this->due_date) {
            return false;
        }
        return $this->due_date->isPast();
    }
}

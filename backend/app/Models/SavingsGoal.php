<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SavingsGoal extends Model
{
    protected $fillable = [
        'user_id',
        'account_id',
        'name',
        'target_amount',
        'deadline',
        'icon',
        'color',
        'priority',
        'notes',
        'status',
    ];

    protected $casts = [
        'target_amount' => 'string',
        'deadline' => 'date:Y-m-d',
        'priority' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function contributions(): HasMany
    {
        return $this->hasMany(SavingsContribution::class);
    }

    public function getSavedAmountAttribute(): string
    {
        $deposit = (float) $this->contributions()->where('type', 'deposit')->sum('amount');
        $withdrawal = (float) $this->contributions()->where('type', 'withdrawal')->sum('amount');
        return number_format(max(0, $deposit - $withdrawal), 2, '.', '');
    }
}

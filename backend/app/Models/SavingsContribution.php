<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavingsContribution extends Model
{
    protected $fillable = [
        'savings_goal_id',
        'user_id',
        'transaction_id',
        'type',
        'amount',
        'date',
        'note',
    ];

    protected $casts = [
        'amount' => 'string',
        'date' => 'date:Y-m-d',
    ];

    public function savingsGoal(): BelongsTo
    {
        return $this->belongsTo(SavingsGoal::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'type',
        'opening_balance',
        'start_date',
        'color',
        'icon',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'opening_balance' => 'string',
        'start_date' => 'date:Y-m-d',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function getBalanceAttribute(): string
    {
        $in = (float) $this->transactions()->where('flow', 'in')->sum('amount');
        $out = (float) $this->transactions()->where('flow', 'out')->sum('amount');
        $net = (float) $this->opening_balance + $in - $out;

        return number_format($net, 2, '.', '');
    }
}

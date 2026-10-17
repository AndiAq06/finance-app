<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillPayment extends Model
{
    protected $fillable = [
        'bill_id',
        'user_id',
        'transaction_id',
        'period_due_date',
        'paid_date',
        'amount',
    ];

    protected $casts = [
        'amount' => 'string',
        'period_due_date' => 'date:Y-m-d',
        'paid_date' => 'date:Y-m-d',
    ];

    public function bill(): BelongsTo
    {
        return $this->belongsTo(Bill::class);
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

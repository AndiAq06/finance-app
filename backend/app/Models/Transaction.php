<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Transaction extends Model
{
    protected $fillable = [
        'user_id',
        'account_id',
        'category_id',
        'type',
        'flow',
        'date',
        'amount',
        'description',
        'notes',
        'counterparty',
        'has_attachment',
        'attachment_name',
        'attachment_path',
        'recurring_id',
        'debt_id',
        'bill_id',
        'locked_reason',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'amount' => 'string',
        'has_attachment' => 'boolean',
        'recurring_id' => 'integer',
        'debt_id' => 'integer',
        'bill_id' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function recurring(): BelongsTo
    {
        return $this->belongsTo(Recurring::class);
    }

    public function debt(): BelongsTo
    {
        return $this->belongsTo(Debt::class);
    }

    public function bill(): BelongsTo
    {
        return $this->belongsTo(Bill::class);
    }

    public function transferAsSender(): HasOne
    {
        return $this->hasOne(Transfer::class, 'from_transaction_id');
    }

    public function transferAsReceiver(): HasOne
    {
        return $this->hasOne(Transfer::class, 'to_transaction_id');
    }

    public function getTransferInfoAttribute(): ?array
    {
        if ($this->type !== 'transfer') {
            return null;
        }

        $tr = $this->transferAsSender ?? $this->transferAsReceiver;
        if (! $tr) {
            return null;
        }

        return [
            'id' => $tr->id,
            'from_account_id' => $tr->from_account_id,
            'to_account_id' => $tr->to_account_id,
            'from_account' => $tr->fromAccount?->name,
            'to_account' => $tr->toAccount?->name,
        ];
    }
}

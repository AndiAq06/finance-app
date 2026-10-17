<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Preference extends Model
{
    protected $fillable = [
        'user_id',
        'currency',
        'locale',
        'timezone',
        'date_format',
        'theme',
        'week_starts_on',
        'notify_transaction',
        'notify_budget',
        'notify_bill',
        'notify_goal',
        'notify_debt',
        'bill_reminder_days',
        'hide_sensitive_in_notifications',
    ];

    protected function casts(): array
    {
        return [
            'week_starts_on' => 'integer',
            'notify_transaction' => 'boolean',
            'notify_budget' => 'boolean',
            'notify_bill' => 'boolean',
            'notify_goal' => 'boolean',
            'notify_debt' => 'boolean',
            'bill_reminder_days' => 'integer',
            'hide_sensitive_in_notifications' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

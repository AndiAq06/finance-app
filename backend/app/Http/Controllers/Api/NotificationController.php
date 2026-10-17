<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Cek pengingat tagihan dan budget otomatis untuk membuat notifikasi
        $this->generateReminders($user);

        $notifications = $user->notifications()->orderBy('created_at', 'desc')->take(30)->get();
        $unreadCount = $user->notifications()->whereNull('read_at')->count();

        $data = $notifications->map(fn (AppNotification $n) => [
            'id' => $n->id,
            'type' => $n->type,
            'title' => $n->title,
            'body' => $n->body,
            'link' => $n->link,
            'severity' => $n->severity,
            'read_at' => $n->read_at ? $n->read_at->toISOString() : null,
            'created_at' => $n->created_at ? $n->created_at->toISOString() : null,
        ]);

        return response()->json([
            'data' => $data,
            'unread_count' => $unreadCount,
        ]);
    }

    public function markAsRead(Request $request, $id): JsonResponse
    {
        $notif = $request->user()->notifications()->findOrFail($id);
        $notif->update(['read_at' => Carbon::now()]);

        return response()->json(['message' => 'Notifikasi ditandai sudah dibaca.']);
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $request->user()->notifications()->whereNull('read_at')->update(['read_at' => Carbon::now()]);

        return response()->json(['message' => 'Semua notifikasi ditandai sudah dibaca.']);
    }

    protected function generateReminders($user): void
    {
        $pref = $user->preference;
        if (! $pref) return;

        // Cek tagihan jatuh tempo
        if ($pref->notify_bill) {
            $days = $pref->bill_reminder_days ?: 3;
            $threshold = Carbon::today()->addDays($days)->format('Y-m-d');
            $bills = $user->bills()
                ->where('is_active', true)
                ->whereNotNull('next_due_date')
                ->where('next_due_date', '<=', $threshold)
                ->get();

            foreach ($bills as $bill) {
                $alreadyNotified = $user->notifications()
                    ->where('type', 'bill_reminder')
                    ->where('created_at', '>=', Carbon::today())
                    ->where('body', 'like', "%{$bill->name}%")
                    ->exists();

                if (! $alreadyNotified) {
                    $dueStr = $bill->next_due_date ? $bill->next_due_date->format('d/m/Y') : '';
                    $sev = $bill->is_overdue ? 'danger' : 'warning';
                    AppNotification::create([
                        'user_id' => $user->id,
                        'type' => 'bill_reminder',
                        'title' => $bill->is_overdue ? 'Tagihan Telah Jatuh Tempo!' : 'Pengingat Tagihan Mendekat',
                        'body' => "Tagihan \"{$bill->name}\" sebesar Rp".number_format((float) $bill->amount, 0, ',', '.')." jatuh tempo pada {$dueStr}.",
                        'link' => '/bills',
                        'severity' => $sev,
                    ]);
                }
            }
        }
    }
}

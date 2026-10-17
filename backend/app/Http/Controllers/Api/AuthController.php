<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Preference;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'remember' => 'nullable|boolean',
        ]);

        if (! Auth::attempt(['email' => $validated['email'], 'password' => $validated['password']], (bool) ($validated['remember'] ?? false))) {
            throw ValidationException::withMessages([
                'email' => ['Email atau kata sandi yang Anda masukkan salah.'],
            ]);
        }

        $request->session()->regenerate();
        $user = Auth::user();

        return response()->json([
            'user' => $this->formatUser($user),
            'preferences' => $this->getOrCreatePreferences($user),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:150|unique:users,email',
            'password' => 'required|string|min:6',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'is_demo' => false,
        ]);

        $pref = Preference::create([
            'user_id' => $user->id,
            'currency' => 'IDR',
            'locale' => 'id',
            'timezone' => 'Asia/Jakarta',
            'date_format' => 'd MMM yyyy',
            'theme' => 'light',
            'week_starts_on' => 1,
            'notify_transaction' => true,
            'notify_budget' => true,
            'notify_bill' => true,
            'notify_goal' => true,
            'notify_debt' => true,
            'bill_reminder_days' => 3,
            'hide_sensitive_in_notifications' => false,
        ]);

        $this->seedDefaultCategories($user);

        Auth::login($user, true);
        $request->session()->regenerate();

        return response()->json([
            'user' => $this->formatUser($user),
            'preferences' => $pref,
        ], 201);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return response()->json([
            'user' => $this->formatUser($user),
            'preferences' => $this->getOrCreatePreferences($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Berhasil keluar.'], 200);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $user = $request->user();
        $pref = $this->getOrCreatePreferences($user);

        $validated = $request->validate([
            'currency' => 'sometimes|string|max:10',
            'locale' => 'sometimes|string|max:10',
            'timezone' => 'sometimes|string|max:50',
            'date_format' => 'sometimes|string|max:30',
            'theme' => 'sometimes|in:light,dark,system',
            'week_starts_on' => 'sometimes|integer|between:0,6',
            'notify_transaction' => 'sometimes|boolean',
            'notify_budget' => 'sometimes|boolean',
            'notify_bill' => 'sometimes|boolean',
            'notify_goal' => 'sometimes|boolean',
            'notify_debt' => 'sometimes|boolean',
            'bill_reminder_days' => 'sometimes|integer|min:1|max:30',
            'hide_sensitive_in_notifications' => 'sometimes|boolean',
        ]);

        $pref->update($validated);

        return response()->json(['preferences' => $pref]);
    }

    protected function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_demo' => (bool) $user->is_demo,
            'created_at' => $user->created_at->toISOString(),
        ];
    }

    protected function getOrCreatePreferences(User $user): Preference
    {
        return $user->preference ?: Preference::create([
            'user_id' => $user->id,
            'currency' => 'IDR',
            'locale' => 'id',
            'timezone' => 'Asia/Jakarta',
            'date_format' => 'd MMM yyyy',
            'theme' => 'light',
            'week_starts_on' => 1,
            'notify_transaction' => true,
            'notify_budget' => true,
            'notify_bill' => true,
            'notify_goal' => true,
            'notify_debt' => true,
            'bill_reminder_days' => 3,
            'hide_sensitive_in_notifications' => false,
        ]);
    }

    protected function seedDefaultCategories(User $user): void
    {
        $categories = [
            ['name' => 'Gaji & Upah', 'type' => 'income', 'icon' => 'banknote', 'color' => '#16A34A'],
            ['name' => 'Bisnis & Proyek', 'type' => 'income', 'icon' => 'briefcase', 'color' => '#0EA5E9'],
            ['name' => 'Investasi & Bunga', 'type' => 'income', 'icon' => 'trending-up', 'color' => '#8B5CF6'],
            ['name' => 'Bonus & Hadiah', 'type' => 'income', 'icon' => 'gift', 'color' => '#EC4899'],
            ['name' => 'Makanan & Minuman', 'type' => 'expense', 'icon' => 'utensils', 'color' => '#F97316'],
            ['name' => 'Transportasi', 'type' => 'expense', 'icon' => 'car', 'color' => '#0EA5E9'],
            ['name' => 'Belanja Kebutuhan', 'type' => 'expense', 'icon' => 'shopping-bag', 'color' => '#E11D48'],
            ['name' => 'Tagihan & Utilitas', 'type' => 'expense', 'icon' => 'receipt', 'color' => '#F59E0B'],
            ['name' => 'Tempat Tinggal', 'type' => 'expense', 'icon' => 'home', 'color' => '#6366F1'],
            ['name' => 'Hiburan & Hobi', 'type' => 'expense', 'icon' => 'clapperboard', 'color' => '#8B5CF6'],
            ['name' => 'Kesehatan & Medis', 'type' => 'expense', 'icon' => 'heart-pulse', 'color' => '#EC4899'],
            ['name' => 'Pendidikan', 'type' => 'expense', 'icon' => 'graduation-cap', 'color' => '#14B8A6'],
        ];

        foreach ($categories as $cat) {
            Category::create(array_merge($cat, ['user_id' => $user->id, 'is_default' => true]));
        }
    }
}

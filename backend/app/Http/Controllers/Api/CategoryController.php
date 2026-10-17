<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $categories = Category::where('user_id', $user->id)
            ->orWhereNull('user_id')
            ->withCount('transactions')
            ->orderBy('type')
            ->orderBy('name')
            ->get();

        $data = $categories->map(fn (Category $c) => [
            'id' => $c->id,
            'name' => $c->name,
            'type' => $c->type,
            'icon' => $c->icon,
            'color' => $c->color,
            'is_default' => (bool) $c->is_default,
            'transactions_count' => $c->transactions_count,
        ]);

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'required|in:income,expense',
            'icon' => 'required|string|max:50',
            'color' => 'required|string|max:20',
        ]);

        $category = Category::create(array_merge($validated, [
            'user_id' => $user->id,
            'is_default' => false,
        ]));

        return response()->json(['data' => $category], 201);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $category = Category::where('user_id', $user->id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'type' => 'sometimes|in:income,expense',
            'icon' => 'sometimes|string|max:50',
            'color' => 'sometimes|string|max:20',
        ]);

        $category->update($validated);

        return response()->json(['data' => $category]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $category = Category::where('user_id', $user->id)->findOrFail($id);

        if ($category->transactions()->exists()) {
            return response()->json(['message' => 'Kategori ini tidak dapat dihapus karena memiliki transaksi.'], 422);
        }

        $category->delete();

        return response()->json(['message' => 'Kategori berhasil dihapus.']);
    }
}

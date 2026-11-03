import { NextResponse } from 'next/server';
import { upstream, ApiError, selectedStore } from '@/lib/upstream';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const barcode = (code || '').trim();

  if (!barcode) {
    return NextResponse.json({ message: 'Штрихкод не указан' }, { status: 400 });
  }

  try {
    const data = await upstream(`products/search/barcode/${encodeURIComponent(barcode)}?storeId=${await selectedStore()}`, {
      cache: 'no-store',
    });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.payload || { message: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Ошибка поиска по штрихкоду' },
      { status: 500 },
    );
  }
}

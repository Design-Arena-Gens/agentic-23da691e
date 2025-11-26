import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { prompt, width, height } = (await request.json()) as {
      prompt?: string;
      width?: number;
      height?: number;
    };

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt requerido.' }, { status: 400 });
    }

    const resolvedWidth = Math.min(Math.max(Number(width) || 1024, 512), 2048);
    const resolvedHeight = Math.min(Math.max(Number(height) || 1024, 512), 2048);

    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=${resolvedWidth}&height=${resolvedHeight}&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;

    const response = await fetch(pollinationsUrl, {
      headers: {
        Accept: 'image/jpeg'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'El modelo de imagen no está disponible.' }, { status: 502 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    return NextResponse.json({ image: dataUrl });
  } catch (error) {
    console.error('Error generating image', error);
    return NextResponse.json({ error: 'Error inesperado generando la imagen.' }, { status: 500 });
  }
}

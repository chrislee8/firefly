import { ImageResponse } from 'next/og';
import { getArticle } from '@/lib/feed';
import { FIREFLY_DATA_URI, fireflyField } from '@/lib/og-firefly';

export const runtime = 'nodejs';
export const alt = 'Firefly — AI news, ranked by what matters';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id).catch(() => null);

  const title = article?.title ?? 'Firefly';
  const category = (article?.category ?? 'AI News').toUpperCase();
  const source = article?.source_name ?? '';
  const score = article ? Math.round(article.effective_score) : null;
  // Scale the headline down for long titles so it always fits.
  const titleSize = title.length > 120 ? 46 : title.length > 80 ? 56 : title.length > 48 ? 66 : 78;

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#080a05',
          backgroundImage: 'linear-gradient(150deg, #12160c 0%, #080a05 55%, #030402 100%)',
        }}
      >
        {/* ambient night sky (subtle, behind the text) */}
        {fireflyField({ count: 16, seed: 24, maxOpacity: 0.45 })}

        {/* header: mark + wordmark + category */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FIREFLY_DATA_URI} width={72} height={72} alt="" />
          <div style={{ display: 'flex', color: '#f2f0e6', fontSize: 30, fontWeight: 700, letterSpacing: 6 }}>FIREFLY</div>
          <div style={{ display: 'flex', color: '#ffd23f', fontSize: 24, letterSpacing: 4, marginLeft: 8 }}>· {category}</div>
        </div>

        {/* headline */}
        <div
          style={{
            display: 'flex',
            color: '#f2f0e6',
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.16,
            maxWidth: 1056,
          }}
        >
          {title}
        </div>

        {/* footer: source + score */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', color: 'rgba(242,240,230,0.55)', fontSize: 30, letterSpacing: 1 }}>{source}</div>
          {score !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', color: 'rgba(242,240,230,0.5)', fontSize: 24, letterSpacing: 3 }}>SCORE</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 96,
                  height: 96,
                  borderRadius: 96,
                  border: '3px solid rgba(255,210,63,0.7)',
                  color: '#ffd23f',
                  fontSize: 44,
                  fontWeight: 700,
                }}
              >
                {score}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}

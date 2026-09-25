import { ImageResponse } from 'next/og';
import { FIREFLY_DATA_URI, fireflyField } from '@/lib/og-firefly';

export const runtime = 'nodejs';
export const alt = 'Firefly — AI news, ranked by what matters';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#070904',
          backgroundImage: 'linear-gradient(160deg, #0c100a 0%, #070904 55%, #020301 100%)',
        }}
      >
        {/* night sky */}
        {fireflyField({ count: 30, seed: 711 })}

        {/* brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FIREFLY_DATA_URI} width={210} height={210} alt="" />
          <div style={{ display: 'flex', color: '#f2f0e6', fontSize: 100, fontWeight: 800, letterSpacing: 12, marginTop: -14 }}>
            FIREFLY
          </div>
          <div style={{ display: 'flex', color: 'rgba(242,240,230,0.62)', fontSize: 36, letterSpacing: 2, marginTop: 12 }}>
            AI news, ranked by what matters
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

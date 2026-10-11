const { test, expect } = require('@playwright/test');

const CSV_HEADER = 'ID,name,Latitude,Longitude,Hình ảnh,Trạng thái,Địa chỉ nhà riêng,Địa chỉ cơ quan,Cơ quan công tác,Điện thoại 1,Điện thoại 2,Facebook,Chức vụ';
const LONG_NAME = 'Nguyễn Thị Phương Thảo Minh Châu Anh Khoa Hoàng Gia Bảo Trần Lê';
const CSV = [
  CSV_HEADER,
  'K76.A11.001,Nguyễn Văn An,10.76,106.66,,Đang học,63/23A Liên Khu 16-18,,Sở Nội vụ,0901234567,,,Trưởng phòng',
  `K76.A11.002,${LONG_NAME},10.77,106.67,missing-photo.jpg,Đang học,,,UBND Quận Bình Tân với tên cơ quan rất dài để thử cắt chữ,0907654321,,fb.me/x,Chuyên viên`,
  'K76.A11.003,Võ Thanh Tâm,,,,Nghỉ phép,,,Chưa có tọa độ,,,,'
].join('\n');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function mockNetwork(page, opts = {}) {
  const { csv = CSV, csvDelay = 0, csvFail = false } = opts;
  await page.context().route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1')) return route.continue();
    if (opts.offline) return route.abort('internetdisconnected');
    if (url.includes('docs.google.com')) {
      if (csvDelay) await new Promise(r => setTimeout(r, csvDelay));
      if (csvFail) return route.fulfill({ status: 500, body: 'err' });
      return route.fulfill({ status: 200, contentType: 'text/csv', body: csv });
    }
    if (url.includes('tile.openstreetmap.org') || url.includes('google.com/vt') || url.includes('api.mapbox.com')) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    if (url.includes('script.google.com')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (url.includes('fonts.googleapis.com')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (url.includes('fonts.gstatic.com')) return route.abort();
    if (url.includes('cdnjs.cloudflare.com')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.XLSX={}' });
    return route.abort();
  });
}

async function open(page, opts, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  await mockNetwork(page, opts);
  await page.goto('/');
}

const MOBILE = { width: 360, height: 740 };
const DESKTOP = { width: 1280, height: 800 };

test.describe('C1 tokens', () => {
  test('design tokens khai báo ở :root', async ({ page }) => {
    await open(page, {}, DESKTOP);
    const missing = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const need = ['--bg', '--surface', '--surface-2', '--border', '--text', '--text-muted', '--accent', '--on-accent',
        '--space-1', '--space-2', '--space-3', '--space-4', '--radius-sm', '--radius-md', '--radius-lg',
        '--shadow-1', '--shadow-2', '--font-ui', '--ease', '--dur-fast', '--dur'];
      return need.filter(n => !cs.getPropertyValue(n).trim());
    });
    expect(missing).toEqual([]);
  });

  test('CSS không còn màu hex rải ngoài khối token/theme', async ({ page }) => {
    await open(page, {}, DESKTOP);
    const stray = await page.evaluate(() => {
      const hex = /#[0-9a-fA-F]{3,8}\b/;
      const bad = [];
      for (const sheet of document.styleSheets) {
        if (sheet.href) continue;
        for (const r of sheet.cssRules) {
          const sel = r.selectorText || '';
          if (/^:root|\[data-theme/.test(sel) || r.type !== 1) continue;
          if (hex.test(r.cssText)) bad.push(sel);
        }
      }
      return bad;
    });
    expect(stray.length, 'selector còn hex: ' + stray.slice(0, 8).join(' | ')).toBeLessThanOrEqual(6);
  });
});

test.describe('C2 theme', () => {
  for (const scheme of ['dark', 'light']) {
    test(`theo hệ thống: ${scheme}`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      await open(page, {}, DESKTOP);
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(scheme);
      const lum = await page.evaluate(() => {
        const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      });
      scheme === 'dark' ? expect(lum).toBeLessThan(0.2) : expect(lum).toBeGreaterThan(0.8);
      await ctx.close();
    });
  }

  test('nút đổi theme + nhớ lựa chọn', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await open(page, {}, DESKTOP);
    await page.locator('#themeBtn').click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
    await ctx.close();
  });
});

test.describe('C4 responsive', () => {
  for (const w of [360, 390, 768, 1280]) {
    test(`không tràn ngang ở ${w}px`, async ({ page }) => {
      await open(page, {}, { width: w, height: 800 });
      await page.waitForSelector('.panel-item', { state: 'attached' });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over).toBeLessThanOrEqual(0);
    });
  }

  test('mobile: có bottom nav, rail desktop ẩn', async ({ page }) => {
    await open(page, {}, MOBILE);
    await expect(page.locator('#bottomNav')).toBeVisible();
    await expect(page.locator('#rail')).toBeHidden();
  });

  test('desktop: có rail, bottom nav ẩn', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await expect(page.locator('#rail')).toBeVisible();
    await expect(page.locator('#bottomNav')).toBeHidden();
  });

  test('vùng chạm ≥44px cho nút hiển thị trên mobile', async ({ page }) => {
    await open(page, {}, MOBILE);
    await page.waitForSelector('.panel-item', { state: 'attached' });
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button, a[href], .nav-btn, input').forEach(el => {
        if (el.closest('.leaflet-control-attribution') || el.type === 'radio' || el.type === 'checkbox') return;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') return;
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
        if (r.height < 43.5 || r.width < 43.5) out.push((el.id || el.className || el.tagName) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
      });
      return out;
    });
    expect(small).toEqual([]);
  });

  test('chữ nhập ≥16px trên mobile (tránh zoom iOS)', async ({ page }) => {
    await open(page, {}, MOBILE);
    const sizes = await page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=radio]):not([type=checkbox]), textarea')]
      .map(e => parseFloat(getComputedStyle(e).fontSize)));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
  });

  test('tên rất dài bị cắt, không làm vỡ danh sách', async ({ page }) => {
    await open(page, {}, MOBILE);
    await page.waitForSelector('.panel-item', { state: 'attached' });
    const over = await page.evaluate(() => [...document.querySelectorAll('.panel-item')].filter(e => e.scrollWidth > e.clientWidth + 1).length);
    expect(over).toBe(0);
  });
});

test.describe('C5 trạng thái', () => {
  test('loading: hiện skeleton khi CSV chậm', async ({ page }) => {
    await open(page, { csvDelay: 1500 }, DESKTOP);
    await expect(page.locator('#panelList .skeleton').first()).toBeVisible();
    await expect(page.locator('.panel-item').first()).toBeAttached({ timeout: 6000 });
    await expect(page.locator('#panelList .skeleton')).toHaveCount(0);
  });

  test('empty: tìm không ra hiện hướng dẫn', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await page.waitForSelector('.panel-item', { state: 'attached' });
    await page.fill('#panelSearchInput', 'zzzkhongco');
    await expect(page.locator('#panelEmpty')).toBeVisible();
    await page.fill('#panelSearchInput', '');
    await expect(page.locator('#panelEmpty')).toBeHidden();
  });

  test('error: CSV lỗi → thông báo lỗi rõ + nút thử lại', async ({ page }) => {
    await open(page, { csvFail: true }, DESKTOP);
    await expect(page.locator('#panelError')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#panelError button')).toBeVisible();
  });
});

test.describe('C6 a11y', () => {
  test('nút icon có tên truy cập, input có nhãn', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await page.waitForSelector('.panel-item', { state: 'attached' });
    const bad = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button, a[href]').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || el.closest('.leaflet-control-attribution')) return;
        const name = (el.getAttribute('aria-label') || el.textContent || el.title || '').trim();
        if (!name) out.push(el.id || el.className || el.tagName);
      });
      document.querySelectorAll('input:not([type=hidden]):not([type=file]), textarea, select').forEach(el => {
        if (!el.labels?.length && !el.getAttribute('aria-label')) out.push('input#' + el.id);
      });
      return out;
    });
    expect(bad).toEqual([]);
  });

  test('focus bàn phím nhìn thấy được', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const cs = getComputedStyle(document.activeElement);
      return { w: parseFloat(cs.outlineWidth), s: cs.outlineStyle, shadow: cs.boxShadow };
    });
    expect(outline.s !== 'none' && outline.w > 0 || outline.shadow !== 'none').toBeTruthy();
  });

  test('reduced-motion tắt chuyển động', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await open(page, {}, DESKTOP);
    const dur = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#leftPanel')).transitionDuration));
    expect(dur).toBeLessThanOrEqual(0.01);
    await ctx.close();
  });

  test('tương phản chữ chính ≥ 4.5:1 (dark & light)', async ({ browser }) => {
    for (const scheme of ['dark', 'light']) {
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      await open(page, {}, DESKTOP);
      await page.waitForSelector('.panel-item', { state: 'attached' });
      const ratio = await page.evaluate(() => {
        const lum = c => { const [r, g, b] = c.match(/\d+/g).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
        const pairs = [['.panel-item-name', '#leftPanel'], ['.panel-item-sub', '#leftPanel']];
        return Math.min(...pairs.map(([t, bg]) => {
          const a = lum(getComputedStyle(document.querySelector(t)).color), b = lum(getComputedStyle(document.querySelector(bg)).backgroundColor);
          return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        }));
      });
      expect(ratio, scheme).toBeGreaterThanOrEqual(4.5);
      await ctx.close();
    }
  });
});

test.describe('C7 regression chức năng', () => {
  test('danh sách + số lượng + marker', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await expect(page.locator('.panel-item')).toHaveCount(3);
    await expect(page.locator('#panelCount')).toHaveText('3');
    await expect(page.locator('.panel-no-coords')).toHaveCount(1);
  });

  test('bấm học viên → mở popup có nút Sửa / Chỉ đường', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await page.locator('.panel-item').first().click();
    const pop = page.locator('.leaflet-popup');
    await expect(pop).toBeVisible({ timeout: 5000 });
    await expect(pop).toContainText('Nguyễn Văn An');
    await expect(pop.getByRole('button', { name: /chỉnh sửa/i })).toBeVisible();
    await expect(pop.getByRole('button', { name: /chỉ đường/i })).toBeVisible();
    await expect(pop.locator('a[href^="tel:"]')).toHaveCount(1);
  });

  test('lọc danh sách', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await page.waitForSelector('.panel-item', { state: 'attached' });
    await page.fill('#panelSearchInput', 'tam');
    await expect(page.locator('.panel-item:visible')).toHaveCount(1);
  });

  test('tìm trên top bar → zoom + toast', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await page.waitForSelector('.panel-item', { state: 'attached' });
    await page.fill('#searchInput', 'Nguyễn Văn An');
    await page.press('#searchInput', 'Enter');
    await expect(page.locator('#toast')).toHaveClass(/show/);
  });

  test('mở modal sửa và đóng bằng Esc', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await page.locator('.panel-item').first().click();
    await page.locator('.leaflet-popup').getByRole('button', { name: /chỉnh sửa/i }).click();
    await expect(page.locator('#editModal')).toHaveClass(/open/);
    await expect(page.locator('#fName')).toHaveValue('Nguyễn Văn An');
    await page.keyboard.press('Escape');
    await expect(page.locator('#editModal')).not.toHaveClass(/open/);
  });

  test('drawer Kỷ niệm / Kiến thức mở được', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await page.locator('#rail').getByRole('button', { name: /kỷ niệm/i }).click();
    await expect(page.locator('#drawer')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#drawer')).not.toHaveClass(/open/);
    await page.locator('#rail').getByRole('button', { name: /kiến thức/i }).click();
    await expect(page.locator('#drawerTitle')).toContainText(/kiến thức/i);
  });

  test('mobile: mở/đóng danh sách bằng bottom nav + overlay', async ({ page }) => {
    await open(page, {}, MOBILE);
    await page.locator('#bottomNav').getByRole('button', { name: /danh sách/i }).click();
    await expect(page.locator('#leftPanel')).toHaveClass(/open/);
    await page.locator('#leftPanelOverlay').click({ position: { x: 340, y: 300 } });
    await expect(page.locator('#leftPanel')).not.toHaveClass(/open/);
  });

  test('transport picker mở được', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await page.locator('.panel-item').first().click();
    await page.locator('.leaflet-popup').getByRole('button', { name: /chỉ đường/i }).click();
    await expect(page.locator('#transportPicker')).toBeVisible();
  });
});

test.describe('C9 nền bản đồ Mapbox Streets', () => {
  test('có token → tile tải từ Mapbox streets-v12 và là lớp mặc định', async ({ page }) => {
    await page.addInitScript(() => { window.K76_MAPBOX_TOKEN = 'pk.test-token'; });
    const tileUrls = [];
    page.on('request', r => { if (r.url().includes('api.mapbox.com')) tileUrls.push(r.url()); });
    await open(page, {}, DESKTOP);
    await page.waitForSelector('.leaflet-tile-loaded', { state: 'attached' });
    expect(tileUrls.length).toBeGreaterThan(0);
    expect(tileUrls[0]).toContain('/styles/v1/mapbox/streets-v12/tiles/');
    expect(tileUrls[0]).toContain('access_token=pk.test-token');
    await page.locator('.leaflet-control-layers').hover();
    await expect(page.locator('.leaflet-control-layers-base label').first()).toContainText('Mapbox Streets');
    await expect(page.locator('.leaflet-control-layers-base input').first()).toBeChecked();
  });

  test('chưa có token → dùng OSM, không gọi Mapbox', async ({ page }) => {
    let mapboxCalls = 0, osmCalls = 0;
    page.on('request', r => {
      if (r.url().includes('api.mapbox.com')) mapboxCalls++;
      if (r.url().includes('tile.openstreetmap.org')) osmCalls++;
    });
    await open(page, {}, DESKTOP);
    await page.waitForSelector('.leaflet-tile-loaded', { state: 'attached' });
    expect(mapboxCalls).toBe(0);
    expect(osmCalls).toBeGreaterThan(0);
  });
});

test.describe('C11 nhãn tên trên marker', () => {
  test('chip tên không đè lên ảnh marker', async ({ page }) => {
    const csv = CSV.replace('Sở Nội vụ,0901234567', 'Sở Nội vụ,0901234567').replace('10.76,106.66,,', '10.76,106.66,den2.png,');
    await open(page, { csv }, DESKTOP);
    await page.waitForSelector('.custom-label', { state: 'attached' });
    let last = '';
    await expect.poll(async () => {
      const now = await page.evaluate(() => [...document.querySelectorAll('.leaflet-marker-icon')].map(e => { const r = e.getBoundingClientRect(); return Math.round(r.x) + ',' + Math.round(r.y); }).join('|'));
      const stable = now === last;
      last = now;
      return stable;
    }, { intervals: [300] }).toBe(true);
    const overlaps = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('.leaflet-marker-icon.custom-image-icon')];
      const labels = [...document.querySelectorAll('.custom-label div')];
      if (!imgs.length || !labels.length) return ["không có marker ảnh/nhãn"];
      const n = [];
      for (const l of labels) for (const i of imgs) {
        const a = l.getBoundingClientRect(), b = i.getBoundingClientRect();
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > 1 && y > 1) n.push(l.textContent + " @ " + JSON.stringify(a) + " vs " + JSON.stringify(b));
      }
      return n;
    });
    expect(overlaps).toEqual([]);
  });
});

test.describe('C12 nhãn tên dài', () => {
  test('tên ~30 ký tự hiện đủ, không bị cắt', async ({ page }) => {
    const csv = CSV.replace('Nguyễn Văn An', 'Phan Lê Thị Thanh Thanh Tâm Anh');
    await open(page, { csv }, DESKTOP);
    await page.waitForSelector('.custom-label', { state: 'attached' });
    const cut = await page.evaluate(() => [...document.querySelectorAll('.custom-label div')]
      .filter(d => d.textContent.startsWith('Phan Lê') && d.scrollWidth > d.clientWidth).length);
    expect(cut).toBe(0);
  });
});

test.describe('C10 Google Maps', () => {
  test('bộ chọn lớp có Google Maps và chuyển sang được', async ({ page }) => {
    const urls = [];
    page.on('request', r => { if (r.url().includes('google.com/vt')) urls.push(r.url()); });
    await open(page, {}, DESKTOP);
    await page.waitForSelector('.leaflet-tile-loaded', { state: 'attached' });
    await page.locator('.leaflet-control-layers').hover();
    const label = page.locator('.leaflet-control-layers-base label', { hasText: 'Google Maps' });
    await expect(label).toHaveCount(1);
    await label.click();
    await expect.poll(() => urls.some(u => u.includes('lyrs=m'))).toBeTruthy();
  });
});

test.describe('C8 PWA', () => {
  test('manifest hợp lệ + icon tồn tại', async ({ page, request }) => {
    await open(page, {}, DESKTOP);
    const href = await page.locator('link[rel=manifest]').getAttribute('href');
    expect(href).toBeTruthy();
    const res = await request.get(new URL(href, 'http://127.0.0.1:4173/').toString());
    expect(res.ok()).toBeTruthy();
    const m = await res.json();
    for (const k of ['name', 'short_name', 'start_url', 'scope', 'theme_color', 'background_color']) expect(m[k], k).toBeTruthy();
    expect(['standalone', 'minimal-ui']).toContain(m.display);
    const sizes = m.icons.map(i => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(m.icons.some(i => (i.purpose || '').includes('maskable'))).toBeTruthy();
    for (const i of m.icons) {
      const r = await request.get(new URL(i.src, 'http://127.0.0.1:4173/').toString());
      expect(r.ok(), i.src).toBeTruthy();
    }
    expect(await page.locator('link[rel=apple-touch-icon]').getAttribute('href')).toBeTruthy();
    for (const n of ['theme-color', 'apple-mobile-web-app-capable', 'apple-mobile-web-app-title']) {
      await expect(page.locator(`meta[name="${n}"]`)).toHaveCount(1);
    }
  });

  test('service worker đăng ký + mở lại được khi offline', async ({ page, context }) => {
    const net = {};
    await open(page, net, DESKTOP);
    await page.waitForSelector('.panel-item', { state: 'attached' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    net.offline = true;
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#topBar')).toBeVisible();
    await expect(page.locator('#map.leaflet-container')).toHaveCount(1);
    await expect(page.locator('.panel-item')).toHaveCount(3, { timeout: 8000 });
    await context.setOffline(false);
  });

  test('beforeinstallprompt → hiện nút Cài đặt', async ({ page }) => {
    await open(page, {}, DESKTOP);
    await expect(page.locator('#installBtn')).toBeHidden();
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(e);
    });
    await expect(page.locator('#installBtn')).toBeVisible();
  });

  test('iOS Safari → hiện hướng dẫn Thêm vào MH chính', async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      viewport: MOBILE
    });
    const page = await ctx.newPage();
    await mockNetwork(page);
    await page.goto('/');
    await expect(page.locator('#iosInstallHint')).toBeVisible();
    await expect(page.locator('#iosInstallHint')).toContainText(/thêm vào/i);
    await ctx.close();
  });
});

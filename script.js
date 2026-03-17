// Mobile menu toggle
const toggle = document.getElementById('menu-toggle');
const nav = document.getElementById('site-nav');

toggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
});

// Close mobile menu on nav link click
nav?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// Header scroll shadow + logo fade
const header = document.querySelector('.site-header');
window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 10);
  header?.classList.toggle('logo-visible', window.scrollY > window.innerHeight * 0.6);
}, { passive: true });

// Tidal word cycle
const words = ['Science', 'Art', 'Education', 'Media', 'Restoration','Stories'];
let wordIdx = 0;
const wordEl = document.getElementById('tagline-word');

function cycleWord() {
  // tide out
  wordEl.style.animation = 'tideOut 0.49s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards';

  setTimeout(() => {
    wordIdx = (wordIdx + 1) % words.length;
    wordEl.textContent = words[wordIdx];
    // force reflow so animation restarts cleanly
    void wordEl.offsetWidth;
    wordEl.style.animation = 'tideIn 0.68s cubic-bezier(0.23, 1, 0.32, 1) forwards';
  }, 490);
}

if (wordEl) setInterval(cycleWord, 2250);

// Lock word-wrap to widest word width so "Marine" never moves
const wordWrap = document.querySelector('.word-wrap');

function setWordWrapWidth() {
  if (!wordWrap || !wordEl) return;
  const computed = getComputedStyle(wordEl);
  const probe = document.createElement('span');
  probe.style.cssText = `
    font-family: ${computed.fontFamily};
    font-size: ${computed.fontSize};
    letter-spacing: ${computed.letterSpacing};
    white-space: nowrap;
    visibility: hidden;
    position: fixed;
    top: 0; left: 0;
  `;
  document.body.appendChild(probe);
  let maxW = 0;
  words.forEach(w => {
    probe.textContent = w;
    maxW = Math.max(maxW, probe.offsetWidth);
  });
  document.body.removeChild(probe);
  wordWrap.style.minWidth = maxW + 'px';
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(setWordWrapWidth, 100);
}, { passive: true });

document.fonts.ready.then(setWordWrapWidth);

// Instagram feed via Behold
async function loadInstagramFeed() {
  const grid = document.getElementById('ig-grid');
  if (!grid) return;

  try {
    const res = await fetch('https://feeds.behold.so/izMRpKN6ougtmDJph10U');
    const data = await res.json();
    const posts = data.posts.slice(0, 6);

    grid.innerHTML = posts.map(post => {
      const imgUrl = post.thumbnailUrl || post.sizes?.medium?.url || post.mediaUrl;
      const alt = post.prunedCaption || 'Instagram post';
      return `<a class="ig-post" href="${post.permalink}" target="_blank" rel="noopener" aria-label="${alt}"><img src="${imgUrl}" alt="${alt}" loading="lazy"></a>`;
    }).join('');
  } catch (err) {
    console.warn('Instagram feed failed to load', err);
  }
}

loadInstagramFeed();

// Collab logo carousel — JS-driven with center spotlight
(function () {
  const track = document.querySelector('.collab-track');
  if (!track) return;

  const logos = Array.from(track.querySelectorAll('.collab-logo'));
  const BASE_SPEED = 3.5;   // px per frame at full speed
  const MIN_SPEED  = .84;   // px per frame when logo is dead center
  const SLOW_RANGE = 75;    // px from center to start slowing
  const SCALE_MAX  = 1.25;   // max scale at dead center
  const SCALE_RANGE = 160;   // px from center to start scaling

  let pos = 0;

  const marquee = track.closest('.collab-marquee');

  function tick() {
    const halfWidth = track.scrollWidth / 2;
    const mRect = marquee.getBoundingClientRect();
    const viewCenter = mRect.left + mRect.width / 2;

    // Find closest logo to center
    let minDist = Infinity;
    logos.forEach(logo => {
      const r = logo.getBoundingClientRect();
      const dist = Math.abs((r.left + r.width / 2) - viewCenter);
      if (dist < minDist) minDist = dist;
    });

    // Ease speed down near center
    const t = Math.max(0, Math.min(1, minDist / SLOW_RANGE));
    const speed = MIN_SPEED + (BASE_SPEED - MIN_SPEED) * t;

    pos -= speed;
    if (pos <= -halfWidth) pos += halfWidth;
    track.style.transform = `translateX(${pos}px)`;

    // Scale + clear filter for each logo based on distance from center
    logos.forEach(logo => {
      const r = logo.getBoundingClientRect();
      const dist = Math.abs((r.left + r.width / 2) - viewCenter);
      if (dist < SCALE_RANGE) {
        const t = 1 - dist / SCALE_RANGE;
        const s = 1 + (SCALE_MAX - 1) * t;
        const grayscale = 40 * (1 - t);
        const opacity = 0.75 + 0.25 * t;
        logo.style.transform = `scale(${s})`;
        logo.style.filter = `grayscale(${grayscale}%) opacity(${opacity})`;
      } else {
        logo.style.transform = 'scale(1)';
        logo.style.filter = 'grayscale(40%) opacity(0.75)';
      }
    });

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();

// Fish school animation — starts when about section scrolls into view
(function () {
  const aboutSection = document.querySelector('.about-strip');
  if (!aboutSection) return;

  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      aboutSection.classList.add('fish-active');
      observer.disconnect();
    }
  }, { threshold: 0.1 });

  observer.observe(aboutSection);
})();

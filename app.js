// 배포 후 이 값을 Apps Script 웹앱 실행 URL로 교체하세요.
// 예: https://script.google.com/macros/s/AKfycb.../exec
const API_URL = 'https://script.google.com/macros/s/AKfycbzEOsTaJ8pU5926iUT4sDlOFJlmPL-cgdS_H7vU8jog5smW6IuFK2sCJ-P9mmrgtCBu/exec';

const filters = ['전체', '텍스트', '사진', '혼합', '위로', '관계', '감사', '가족', '인생', '하루'];

const PAGE_SIZE = 12;

let cards = [];

const state = {
  query: '',
  filter: '전체',
  total: 0,
  hasMore: false,
  loading: false,
};

async function fetchCardsPage(offset, limit) {
  const params = new URLSearchParams({
    action: 'cards',
    offset: String(offset),
    limit: String(limit),
    query: state.query,
    filter: state.filter,
  });
  const res = await fetch(`${API_URL}?${params.toString()}`);
  if (!res.ok) throw new Error('네트워크 오류');
  const data = await res.json();
  const normalized = data.cards.map((card) => ({
    ...card,
    tags: String(card.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    imageUrls: card.images || [],
  }));
  return { cards: normalized, total: data.total, hasMore: data.hasMore };
}

// reset=true: 검색어/필터가 바뀌어서 처음부터 다시 불러오는 경우
// reset=false: "더 보기"로 이어서 불러오는 경우
async function loadCards(reset) {
  if (state.loading) return;
  state.loading = true;

  if (reset) {
    cards = [];
    cardGrid.innerHTML = '<p class="empty-state">불러오는 중...</p>';
  } else {
    renderCards(); // "불러오는 중..." 더보기 버튼 표시
  }

  try {
    const page = await fetchCardsPage(cards.length, PAGE_SIZE);
    cards = reset ? page.cards : cards.concat(page.cards);
    state.total = page.total;
    state.hasMore = page.hasMore;
  } catch (err) {
    cardGrid.innerHTML = `<p class="empty-state">글을 불러오지 못했습니다. API_URL 설정을 확인해주세요.</p>`;
    state.loading = false;
    return;
  }
  state.loading = false;
  renderCards();
}

function loadMore() {
  loadCards(false);
}

let searchDebounceTimer = null;
function onSearchInput(value) {
  state.query = value;
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => loadCards(true), 300);
}

const typeLabels = {
  text: '텍스트',
  image: '사진',
  mixed: '혼합',
};

const searchInput = document.querySelector('#searchInput');
const filterBar = document.querySelector('#filterBar');
const cardGrid = document.querySelector('#cardGrid');
const resultSummary = document.querySelector('#resultSummary');
const detailDialog = document.querySelector('#detailDialog');
const detailContent = document.querySelector('#detailContent');
const closeButton = document.querySelector('.close-button');

function parseImageList_(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch (e) {
    return [value];
  }
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function highlight(value) {
  const text = escapeHtml(value);
  const query = state.query.trim();
  if (!query) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escapedQuery, 'gi'), (match) => `<mark>${match}</mark>`);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function excerpt(card) {
  const source = card.textContent || card.ocrText || card.memo || '';
  return source.length > 84 ? `${source.slice(0, 83)}…` : source;
}

function renderFilters() {
  filterBar.innerHTML = filters
    .map((filter) => {
      const pressed = filter === state.filter ? 'true' : 'false';
      return `<button class="filter-chip" type="button" aria-pressed="${pressed}" data-filter="${filter}">${filter}</button>`;
    })
    .join('');
}

function renderCards() {
  resultSummary.textContent = state.query
    ? `"${state.query}" 검색 결과: ${state.total}개`
    : `전체 글: ${state.total}개`;

  if (cards.length === 0) {
    cardGrid.innerHTML = state.loading
      ? '<p class="empty-state">불러오는 중...</p>'
      : '<p class="empty-state">찾은 글이 없습니다.</p>';
    return;
  }

  const cardsHtml = cards.map(renderCard).join('');
  const loadMoreHtml = state.hasMore
    ? `<button type="button" class="load-more-btn" id="loadMoreBtn" ${state.loading ? 'disabled' : ''}>
         ${state.loading ? '불러오는 중...' : '더 보기'}
       </button>`
    : '';

  cardGrid.innerHTML = cardsHtml + loadMoreHtml;

  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMore);
}

function renderCard(card) {
  const images = card.imageUrls || [];
  const image = images.length > 0
    ? `<div class="card-image-wrap">
        <img class="card-image" src="${images[0]}" alt="${escapeHtml(card.title)}">
        ${images.length > 1 ? `<span class="image-count-badge">+${images.length - 1}</span>` : ''}
      </div>`
    : '';

  return `
    <article class="memory-card" tabindex="0" role="button" data-id="${card.id}" aria-label="${escapeHtml(card.title)} 상세 보기">
      ${image}
      <div class="card-body">
        <p class="card-meta"><span>${card.date}</span><span>·</span><span>${typeLabels[card.type]}</span></p>
        <h2 class="card-title">${highlight(card.title)}</h2>
        <p class="card-excerpt">${highlight(excerpt(card))}</p>
        <div class="tag-row">
          ${card.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
    </article>
  `;
}

function showDetail(card) {
  const images = card.imageUrls || [];
  const image = images.length > 0
    ? `<div class="detail-gallery">${images.map((url) => `<img class="detail-image" src="${url}" alt="${escapeHtml(card.title)}">`).join('')}</div>`
    : '';
  const text = card.textContent ? `<p class="detail-text">${highlight(card.textContent)}</p>` : '';
  const memo = card.memo ? `<p class="detail-memo">${highlight(card.memo)}</p>` : '';
  const ocr = card.ocrText
    ? `
      <button class="ocr-toggle" type="button" aria-expanded="false">사진 속 글 보기</button>
      <p class="ocr-text" hidden>${highlight(card.ocrText)}</p>
    `
    : '';

  detailContent.innerHTML = `
    <div class="detail-content">
      <p class="card-meta"><span>${card.date}</span><span>·</span><span>${typeLabels[card.type]}</span></p>
      <h2 class="card-title">${highlight(card.title)}</h2>
      <div class="tag-row">${card.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}</div>
      ${image}
      ${text}
      ${memo}
      ${ocr}
    </div>
  `;

  detailDialog.showModal();
}

function bindEvents() {
  searchInput.addEventListener('input', (event) => {
    onSearchInput(event.target.value);
  });

  filterBar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.filter = button.dataset.filter;
    renderFilters();
    loadCards(true);
  });

  cardGrid.addEventListener('click', (event) => {
    const cardElement = event.target.closest('.memory-card');
    if (!cardElement) return;
    const card = cards.find((item) => item.id === cardElement.dataset.id);
    if (card) showDetail(card);
  });

  cardGrid.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const cardElement = event.target.closest('.memory-card');
    if (!cardElement) return;
    event.preventDefault();
    const card = cards.find((item) => item.id === cardElement.dataset.id);
    if (card) showDetail(card);
  });

  detailContent.addEventListener('click', (event) => {
    const button = event.target.closest('.ocr-toggle');
    if (!button) return;
    const text = detailContent.querySelector('.ocr-text');
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!isOpen));
    text.hidden = isOpen;
  });

  closeButton.addEventListener('click', () => detailDialog.close());

  detailDialog.addEventListener('click', (event) => {
    if (event.target === detailDialog) detailDialog.close();
  });
}

renderFilters();
bindEvents();
loadCards(true);


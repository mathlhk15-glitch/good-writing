// 배포 후 이 값을 Apps Script 웹앱 실행 URL로 교체하세요.
// 예: https://script.google.com/macros/s/AKfycb.../exec
const API_URL = 'https://script.google.com/macros/s/AKfycbzEOsTaJ8pU5926iUT4sDlOFJlmPL-cgdS_H7vU8jog5smW6IuFK2sCJ-P9mmrgtCBu/exec';

const filters = ['전체', '텍스트', '사진', '혼합', '위로', '관계', '감사', '가족', '인생', '하루'];

let cards = [];

const state = {
  query: '',
  filter: '전체',
};

async function loadCards() {
  cardGrid.innerHTML = '<p class="empty-state">불러오는 중...</p>';
  try {
    const res = await fetch(`${API_URL}?action=cards`);
    if (!res.ok) throw new Error('네트워크 오류');
    const data = await res.json();
    cards = data.map((card) => ({
      ...card,
      tags: String(card.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      imageUrls: parseImageList_(card.imageUrl),
    }));
  } catch (err) {
    cardGrid.innerHTML = `<p class="empty-state">글을 불러오지 못했습니다. API_URL 설정을 확인해주세요.</p>`;
    return;
  }
  renderCards();
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

function matchesFilter(card) {
  if (state.filter === '전체') return true;
  if (state.filter === '텍스트') return card.type === 'text';
  if (state.filter === '사진') return card.type === 'image';
  if (state.filter === '혼합') return card.type === 'mixed';
  return card.tags.includes(state.filter);
}

function matchesQuery(card) {
  const query = normalize(state.query);
  if (!query) return true;
  return normalize(card.searchText).includes(query);
}

function getVisibleCards() {
  return cards
    .filter(matchesFilter)
    .filter(matchesQuery)
    .sort((a, b) => b.date.localeCompare(a.date));
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
  const visibleCards = getVisibleCards();

  resultSummary.textContent = state.query
    ? `"${state.query}" 검색 결과: ${visibleCards.length}개`
    : `전체 글: ${visibleCards.length}개`;

  if (visibleCards.length === 0) {
    cardGrid.innerHTML = '<p class="empty-state">찾은 글이 없습니다.</p>';
    return;
  }

  cardGrid.innerHTML = visibleCards.map(renderCard).join('');
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
    state.query = event.target.value;
    renderCards();
  });

  filterBar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.filter = button.dataset.filter;
    renderFilters();
    renderCards();
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
loadCards();


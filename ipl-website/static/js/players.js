// players.js — search, filter, and bio toggle on the players page

(function () {
  'use strict';

  const grid          = document.getElementById('playersGrid');
  const searchInput   = document.getElementById('playerSearch');
  const filterBtns    = document.querySelectorAll('.filter-btn');
  const natFilter     = document.getElementById('nationalityFilter');
  const countEl       = document.getElementById('playersCount');
  const noResults     = document.getElementById('noResults');

  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll('.player-card'));

  let activeRole = 'all';
  let activeNat  = 'all';
  let searchVal  = '';

  // ── Filter logic ────────────────────────────────────────────────────────
  function applyFilters() {
    let visible = 0;

    cards.forEach(function (card) {
      const role = card.dataset.role;
      const nat  = card.dataset.nationality;
      const name = card.dataset.name;

      const matchRole   = activeRole === 'all' || role === activeRole;
      const matchNat    = activeNat  === 'all' || nat  === activeNat;
      const matchSearch = name.includes(searchVal.toLowerCase());

      if (matchRole && matchNat && matchSearch) {
        card.style.display = '';
        visible++;
      } else {
        card.style.display = 'none';
      }
    });

    if (countEl) {
      countEl.textContent = 'Showing ' + visible + ' player' + (visible !== 1 ? 's' : '');
    }

    if (noResults) {
      noResults.classList.toggle('hidden', visible > 0);
    }
  }

  // ── Role filter buttons ─────────────────────────────────────────────────
  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      activeRole = this.dataset.filter;
      applyFilters();
    });
  });

  // ── Nationality select ──────────────────────────────────────────────────
  if (natFilter) {
    natFilter.addEventListener('change', function () {
      activeNat = this.value;
      applyFilters();
    });
  }

  // ── Search input ────────────────────────────────────────────────────────
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      searchVal = this.value.trim();
      applyFilters();
    });
  }

  // ── Bio toggle ──────────────────────────────────────────────────────────
  grid.addEventListener('click', function (e) {
    const bioBtn = e.target.closest('.bio-btn');
    if (!bioBtn) return;

    const wrapper = bioBtn.closest('.player-bio-toggle');
    const bio     = wrapper.querySelector('.player-bio');

    if (bio.classList.contains('hidden')) {
      bio.classList.remove('hidden');
      bioBtn.textContent = 'Player Bio ↑';
    } else {
      bio.classList.add('hidden');
      bioBtn.textContent = 'Player Bio ↓';
    }
  });

})();

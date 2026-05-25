// polls.js — fan poll voting and comment wall on the Fan Zone page

(function () {
  'use strict';

  // ── Poll voting ──────────────────────────────────────────────────────────
  document.querySelectorAll('.poll-card').forEach(function (card) {
    const pollId    = card.dataset.pollId;
    const optBtns   = card.querySelectorAll('.poll-option');
    const statusEl  = card.querySelector('[id^="poll-status-"]');
    const votesEl   = card.querySelector('[id^="poll-votes-"]');
    const voted     = localStorage.getItem('voted_' + pollId);

    // Load existing results on page load
    fetch('/api/poll/results/' + pollId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.total > 0) {
          renderPollResults(card, data.votes, data.total);
          if (statusEl) statusEl.textContent = data.total + ' vote' + (data.total !== 1 ? 's' : '') + ' cast';
          if (votesEl)  votesEl.textContent  = '';
        }
      })
      .catch(function () {});

    if (voted) {
      lockPoll(card, voted);
      if (statusEl) statusEl.textContent = 'You voted: ' + voted;
    }

    optBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (card.classList.contains('poll-voted')) return;

        const option = this.dataset.value;

        fetch('/api/poll/vote', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ poll_id: pollId, option: option })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success) {
            renderPollResults(card, data.votes, data.total);
            lockPoll(card, option);
            localStorage.setItem('voted_' + pollId, option);
            if (statusEl) statusEl.textContent = 'You voted: ' + option;
            if (votesEl)  votesEl.textContent  = data.total + ' vote' + (data.total !== 1 ? 's' : '') + ' cast';
          }
        })
        .catch(function () {
          if (statusEl) statusEl.textContent = 'Could not submit vote. Try again.';
        });
      });
    });
  });

  function renderPollResults(card, votes, total) {
    card.querySelectorAll('.poll-option').forEach(function (btn) {
      const val   = btn.dataset.value;
      const count = votes[val] || 0;
      const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
      const bar   = btn.querySelector('.poll-bar');
      const pctEl = btn.querySelector('.poll-pct');
      if (bar)   bar.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
    });
  }

  function lockPoll(card, selectedValue) {
    card.classList.add('poll-voted');
    card.querySelectorAll('.poll-option').forEach(function (btn) {
      btn.classList.add('voted');
      if (btn.dataset.value === selectedValue) {
        btn.classList.add('selected');
      }
    });
  }

  // ── Comment wall ─────────────────────────────────────────────────────────
  const commentForm    = document.getElementById('commentForm');
  const nameInput      = document.getElementById('commentName');
  const msgInput       = document.getElementById('commentMessage');
  const nameCounter    = document.getElementById('nameCounter');
  const msgCounter     = document.getElementById('msgCounter');
  const submitBtn      = document.getElementById('commentSubmit');
  const feedbackEl     = document.getElementById('commentFeedback');
  const commentsList   = document.getElementById('commentsList');

  if (nameInput && nameCounter) {
    nameInput.addEventListener('input', function () {
      nameCounter.textContent = this.value.length + '/60';
    });
  }

  if (msgInput && msgCounter) {
    msgInput.addEventListener('input', function () {
      msgCounter.textContent = this.value.length + '/500';
    });
  }

  if (commentForm) {
    commentForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const name    = nameInput ? nameInput.value.trim() : '';
      const message = msgInput  ? msgInput.value.trim()  : '';

      if (!name || !message) return;

      if (submitBtn) {
        submitBtn.disabled    = true;
        submitBtn.textContent = 'Posting…';
      }

      fetch('/api/comment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name, message: message })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          prependComment(name, message);
          if (nameInput)  nameInput.value  = '';
          if (msgInput)   msgInput.value   = '';
          if (nameCounter) nameCounter.textContent = '0/60';
          if (msgCounter)  msgCounter.textContent  = '0/500';
          setFeedback('Comment posted! Thanks for joining the Paltan.', 'success');
        } else {
          setFeedback(data.error || 'Something went wrong.', 'error');
        }
      })
      .catch(function () {
        setFeedback('Network error. Please try again.', 'error');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled    = false;
          submitBtn.textContent = 'Post Comment';
        }
      });
    });
  }

  function prependComment(name, message) {
    if (!commentsList) return;

    // Remove the empty placeholder if present
    const placeholder = commentsList.querySelector('.no-comments');
    if (placeholder) placeholder.remove();

    const today = new Date().toISOString().slice(0, 10);
    const item  = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML =
      '<div class="comment-avatar">' + escHtml(name[0].toUpperCase()) + '</div>' +
      '<div class="comment-content">' +
        '<div class="comment-meta">' +
          '<strong>' + escHtml(name) + '</strong>' +
          '<span class="comment-time">' + today + '</span>' +
        '</div>' +
        '<p class="comment-message">' + escHtml(message) + '</p>' +
      '</div>';

    commentsList.insertBefore(item, commentsList.firstChild);
  }

  function setFeedback(msg, type) {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.className   = 'comment-feedback ' + type;
    setTimeout(function () {
      feedbackEl.textContent = '';
      feedbackEl.className   = 'comment-feedback';
    }, 4000);
  }

  // Minimal HTML escaping — prevents XSS in dynamically inserted content
  function escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();

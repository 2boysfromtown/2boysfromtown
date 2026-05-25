import sqlite3
import json
import os
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
app.secret_key = 'mi-paltan-2024-dev-key'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'static', 'data')
DB_PATH = os.path.join(BASE_DIR, 'ipl_fans.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS poll_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            poll_id TEXT NOT NULL,
            option_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS fan_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()


init_db()


def load_json(filename):
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'r') as f:
        return json.load(f)


# ── Page routes ──────────────────────────────────────────────────────────────

@app.route('/')
def index():
    players = load_json('players.json')
    featured = [p for p in players if p.get('featured')][:3]
    return render_template('index.html', featured_players=featured)


@app.route('/team')
def team():
    return render_template('team.html')


@app.route('/players')
def players():
    players_data = load_json('players.json')
    return render_template('players.html', players=players_data)


@app.route('/matches')
def matches():
    matches_data = load_json('matches.json')
    upcoming = [m for m in matches_data if m['status'] == 'upcoming']
    completed = [m for m in matches_data if m['status'] == 'completed']
    return render_template('matches.html', upcoming=upcoming, completed=completed)


@app.route('/stats')
def stats():
    return render_template('stats.html')


@app.route('/fans')
def fans():
    conn = get_db()
    comments = conn.execute(
        'SELECT * FROM fan_comments ORDER BY created_at DESC LIMIT 20'
    ).fetchall()
    conn.close()
    comments_list = [dict(row) for row in comments]
    return render_template('fans.html', comments=comments_list)


@app.route('/news')
def news():
    return render_template('news.html')


# ── API routes ────────────────────────────────────────────────────────────────

@app.route('/api/players')
def api_players():
    return jsonify(load_json('players.json'))


@app.route('/api/matches')
def api_matches():
    return jsonify(load_json('matches.json'))


@app.route('/api/poll/vote', methods=['POST'])
def vote_poll():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON'}), 400

    poll_id = data.get('poll_id', '').strip()
    option = data.get('option', '').strip()

    if not poll_id or not option:
        return jsonify({'error': 'poll_id and option are required'}), 400

    conn = get_db()
    conn.execute(
        'INSERT INTO poll_votes (poll_id, option_text) VALUES (?, ?)',
        (poll_id, option)
    )
    conn.commit()

    rows = conn.execute(
        'SELECT option_text, COUNT(*) as count FROM poll_votes '
        'WHERE poll_id = ? GROUP BY option_text',
        (poll_id,)
    ).fetchall()
    conn.close()

    vote_data = {row['option_text']: row['count'] for row in rows}
    total = sum(vote_data.values())
    return jsonify({'success': True, 'votes': vote_data, 'total': total})


@app.route('/api/poll/results/<poll_id>')
def poll_results(poll_id):
    conn = get_db()
    rows = conn.execute(
        'SELECT option_text, COUNT(*) as count FROM poll_votes '
        'WHERE poll_id = ? GROUP BY option_text',
        (poll_id,)
    ).fetchall()
    conn.close()
    vote_data = {row['option_text']: row['count'] for row in rows}
    total = sum(vote_data.values())
    return jsonify({'votes': vote_data, 'total': total})


@app.route('/api/comment', methods=['POST'])
def add_comment():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON'}), 400

    name = data.get('name', '').strip()
    message = data.get('message', '').strip()

    if not name or not message:
        return jsonify({'error': 'Name and message are required'}), 400
    if len(name) > 60:
        return jsonify({'error': 'Name too long (max 60 chars)'}), 400
    if len(message) > 500:
        return jsonify({'error': 'Message too long (max 500 chars)'}), 400

    conn = get_db()
    conn.execute(
        'INSERT INTO fan_comments (name, message) VALUES (?, ?)',
        (name, message)
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/comments')
def get_comments():
    conn = get_db()
    rows = conn.execute(
        'SELECT name, message, created_at FROM fan_comments '
        'ORDER BY created_at DESC LIMIT 20'
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


if __name__ == '__main__':
    app.run(debug=True, port=5000)

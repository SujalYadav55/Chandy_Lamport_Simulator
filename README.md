# Chandy-Lamport Snapshot Simulator

Simulates the Chandy-Lamport distributed snapshot algorithm with a bank-transfer model
and an interactive web page.

## Files
- `chandy_lamport.py`  - the algorithm (Process, Channel, Message, Simulator)
- `demo.py`            - command-line demo with a consistency check
- `app.py`             - Flask server with a small JSON API
- `templates/index.html`, `static/style.css`, `static/app.js` - the web interface

## Run
    pip install flask
    python demo.py      # terminal version
    python app.py       # web UI at http://127.0.0.1:5000

(The page loads Bootstrap and Google Fonts from a CDN, so it needs internet.)

Correctness check: recorded balances + recorded in-transit money = initial total.

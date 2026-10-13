# Chandy-Lamport Snapshot Simulator (Python + Flask + Bootstrap)

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

## Using the web page
1. Send money between two processes. It stays in the channel until you deliver it.
2. Start a snapshot from any process.
3. Click the tokens with the dashed ring (the front message of each channel) to deliver them,
   or use "Deliver a random message" / "Auto-play".
4. When the status says "Snapshot complete", check the Consistent verdict.

## Algorithm summary
1. Initiator records its own state, sends a MARKER on every outgoing channel,
   and starts recording every incoming channel.
2. On receiving a MARKER on channel C:
   - first marker: record own state, mark C as empty, send MARKERs on all outgoing
     channels, start recording all other incoming channels.
   - later marker: stop recording C; its recorded messages are the channel state.
3. Done when every process has recorded and all channels have stopped recording.

Correctness check: recorded balances + recorded in-transit money = initial total.

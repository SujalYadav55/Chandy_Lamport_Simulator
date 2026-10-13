"""Web UI: run with  python app.py   then open http://127.0.0.1:5000"""
from flask import Flask, render_template, request, jsonify
from chandy_lamport import Simulator

app = Flask(__name__)


def new_sim(n=3):
    return Simulator({f"P{i}": 100 for i in range(1, n + 1)})


sim = new_sim()


def ok():
    return jsonify(ok=True, state=sim.full_state())


def fail(message):
    return jsonify(ok=False, error=message, state=sim.full_state())


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/state")
def state():
    return ok()


@app.post("/api/transfer")
def transfer():
    d = request.get_json(force=True)
    src, dst = d.get("src"), d.get("dst")
    try:
        amount = int(d.get("amount"))
    except (TypeError, ValueError):
        return fail("Enter a whole number for the amount.")
    if src not in sim.processes or dst not in sim.processes or src == dst:
        return fail("Choose two different processes.")
    balance = sim.processes[src].balance
    if amount <= 0:
        return fail("The amount must be above ₹0.")
    if amount > balance:
        return fail(f"{src} only has ₹{balance} to send.")
    sim.transfer(src, dst, amount)
    return ok()


@app.post("/api/deliver")
def deliver():
    d = request.get_json(force=True)
    if (d.get("src"), d.get("dst")) not in sim.channels or not sim.deliver(d["src"], d["dst"]):
        return fail("There is no message waiting on that channel.")
    return ok()


@app.post("/api/deliver_random")
def deliver_random():
    if not sim.deliver_random():
        return fail("No messages are waiting. Send some money first.")
    return ok()


@app.post("/api/step")
def step():
    sim.step()
    return ok()


@app.post("/api/snapshot")
def snapshot():
    pid = request.get_json(force=True).get("pid")
    if pid not in sim.processes:
        return fail("Unknown process.")
    if sim.snapshot_started():
        if not sim.snapshot_complete():
            return fail("A snapshot is already running. Deliver the remaining messages first.")
        sim.clear_snapshot()
    sim.start_snapshot(pid)
    return ok()


@app.post("/api/reset")
def reset():
    global sim
    try:
        n = int(request.get_json(force=True).get("n", 3))
    except (TypeError, ValueError):
        n = 3
    sim = new_sim(max(3, min(5, n)))
    return ok()


if __name__ == "__main__":
    app.run(debug=True)

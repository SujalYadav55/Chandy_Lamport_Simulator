import random
from collections import deque


class Message:
    def __init__(self, kind, amount=0):
        self.kind = kind          # "TRANSFER" or "MARKER"
        self.amount = amount

    def __repr__(self):
        return "MARKER" if self.kind == "MARKER" else f"₹{self.amount}"


class Channel:
    """One-way FIFO channel from src to dst."""
    def __init__(self, src, dst):
        self.src, self.dst = src, dst
        self.queue = deque()


class Process:
    def __init__(self, pid, balance):
        self.pid = pid
        self.balance = balance
        self.recorded_balance = None     # local state saved in snapshot
        self.channel_state = {}          # src -> list of amounts recorded in transit
        self.recording = {}              # src -> True while recording that channel

    @property
    def has_recorded(self):
        return self.recorded_balance is not None


class Simulator:
    def __init__(self, balances):
        """balances: dict like {"P1": 100, "P2": 50, "P3": 75}"""
        self.processes = {p: Process(p, b) for p, b in balances.items()}
        self.channels = {
            (a, b): Channel(a, b)
            for a in balances for b in balances if a != b
        }
        self.initial_total = sum(balances.values())
        self.log = []

    # ---------- normal operation ----------
    def transfer(self, src, dst, amount):
        p = self.processes[src]
        if amount <= 0 or amount > p.balance:
            return False
        p.balance -= amount
        self.channels[(src, dst)].queue.append(Message("TRANSFER", amount))
        self.log.append(f"{src} sent ₹{amount} to {dst}")
        return True

    def random_transfer(self):
        src = random.choice(list(self.processes))
        dst = random.choice([p for p in self.processes if p != src])
        bal = self.processes[src].balance
        if bal > 0:
            self.transfer(src, dst, random.randint(1, max(1, bal // 2)))

    # ---------- snapshot algorithm ----------
    def _record_and_send_markers(self, pid, skip_channel_from=None):
        p = self.processes[pid]
        p.recorded_balance = p.balance
        for other in self.processes:
            if other == pid:
                continue
            # start recording incoming channels (except the one marker came on)
            p.channel_state[other] = []
            p.recording[other] = (other != skip_channel_from)
            # send marker on every outgoing channel
            self.channels[(pid, other)].queue.append(Message("MARKER"))
        self.log.append(f"{pid} recorded its balance (₹{p.recorded_balance}) and sent MARKERs")

    def start_snapshot(self, pid):
        if self.processes[pid].has_recorded:
            return False
        self.log.append(f"--- {pid} starts a snapshot ---")
        self._record_and_send_markers(pid)
        return True

    def clear_snapshot(self):
        """Forget a finished snapshot so a new one can be taken."""
        for p in self.processes.values():
            p.recorded_balance = None
            p.channel_state = {}
            p.recording = {}

    # ---------- message delivery ----------
    def deliver(self, src, dst):
        ch = self.channels[(src, dst)]
        if not ch.queue:
            return False
        msg = ch.queue.popleft()          # FIFO
        p = self.processes[dst]
        if msg.kind == "TRANSFER":
            p.balance += msg.amount
            if p.has_recorded and p.recording.get(src):
                p.channel_state[src].append(msg.amount)   # message was in transit
            self.log.append(f"{dst} received ₹{msg.amount} from {src}")
        else:  # MARKER
            if not p.has_recorded:
                self.log.append(f"{dst} got first MARKER from {src}")
                self._record_and_send_markers(dst, skip_channel_from=src)
                p.channel_state[src] = []         # channel src->dst is empty
            else:
                p.recording[src] = False          # stop recording this channel
                self.log.append(f"{dst} got MARKER from {src}; channel {src}->{dst} = {p.channel_state[src]}")
        return True

    def deliver_random(self):
        ready = [k for k, c in self.channels.items() if c.queue]
        if not ready:
            return False
        return self.deliver(*random.choice(ready))

    # ---------- results ----------
    def snapshot_started(self):
        return any(p.has_recorded for p in self.processes.values())

    def snapshot_complete(self):
        if not all(p.has_recorded for p in self.processes.values()):
            return False
        return not any(any(p.recording.values()) for p in self.processes.values())

    def get_snapshot(self):
        in_transit = {}
        for p in self.processes.values():
            for src, msgs in p.channel_state.items():
                in_transit[f"{src}->{p.pid}"] = list(msgs)
        local = {pid: p.recorded_balance for pid, p in self.processes.items()}
        total = sum(v for v in local.values() if v is not None)
        total += sum(sum(m) for m in in_transit.values())
        return {"local": local, "channels": in_transit, "total": total,
                "expected_total": self.initial_total, "complete": self.snapshot_complete()}

    def current_state(self):
        return {
            "balances": {pid: p.balance for pid, p in self.processes.items()},
            "channels": {f"{a}->{b}": [repr(m) for m in c.queue]
                         for (a, b), c in self.channels.items()},
        }

    # ---------- helpers for the web UI ----------
    def step(self):
        """One random action: usually deliver a message, sometimes send money."""
        if random.random() < 0.35 or not self.deliver_random():
            self.random_transfer()

    def full_state(self):
        procs = [{"id": pid, "balance": p.balance, "recorded": p.has_recorded,
                  "recorded_balance": p.recorded_balance}
                 for pid, p in self.processes.items()]
        chans = [{"src": a, "dst": b,
                  "messages": [{"kind": m.kind, "amount": m.amount} for m in c.queue],
                  "recording": bool(self.processes[b].recording.get(a))}
                 for (a, b), c in self.channels.items()]
        in_transit = sum(m.amount for c in self.channels.values() for m in c.queue)
        accounts = sum(p.balance for p in self.processes.values())
        return {"processes": procs, "channels": chans,
                "snapshot": self.get_snapshot(), "started": self.snapshot_started(),
                "accounts": accounts, "in_transit": in_transit,
                "total_now": accounts + in_transit, "log": self.log[-40:]}

"""Command-line demo: run with  python demo.py"""
import random
from chandy_lamport import Simulator

random.seed(1)
sim = Simulator({"P1": 100, "P2": 100, "P3": 100})

for _ in range(6):                 # some normal activity
    sim.random_transfer()
sim.start_snapshot("P1")           # P1 starts the snapshot
while not sim.snapshot_complete():  # keep running while snapshot is in progress
    sim.random_transfer()
    sim.deliver_random()

for line in sim.log:
    print(line)
snap = sim.get_snapshot()
print("\nSNAPSHOT:", snap)
assert snap["total"] == snap["expected_total"], "Snapshot is inconsistent!"
print("Total money is conserved -> snapshot is consistent")

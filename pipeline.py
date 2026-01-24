import time
from typing import Any, Dict, List, Tuple

import numpy as np

from config import CFG
from event_store import EventStore
from actions import Actions

Event = Dict[str, Any]


class _NoOpGestureDetector:
    """Fallback gesture detector so the program never crashes."""
    def process(self, frame: np.ndarray) -> Tuple[np.ndarray, List[Event]]:
        return frame, []


class Pipeline:
    """
    Core loop logic:
    frame -> detector -> (annotated_frame, events) -> actions -> store
    """
    def __init__(self, store: EventStore, actions: Actions):
        self.store = store
        self.actions = actions
        self.mode = CFG.default_mode  # "motion" or "gesture"

        # Detectors must never open the camera.
        from detectors.motion_detector import MotionDetector  # Zohair
        from detectors.gesture_detector import GestureDetector  # Zohair

        self.motion = MotionDetector()

        # ✅ Critical: gesture must NOT be allowed to kill the whole program
        try:
            self.gesture = GestureDetector()
        except Exception as e:
            print(f"⚠️ GestureDetector failed to init. Gesture mode disabled. Reason: {e}")
            self.gesture = _NoOpGestureDetector()

        self.last_frame = None
        self.last_annotated = None
        self._last_time = 0.0

    def set_mode(self, mode: str) -> None:
        if mode not in ("motion", "gesture"):
            raise ValueError("mode must be 'motion' or 'gesture'")
        self.mode = mode

    def _run_detector(self, frame: np.ndarray) -> Tuple[np.ndarray, List[Event]]:
        if self.mode == "motion":
            return self.motion.process(frame)
        return self.gesture.process(frame)

    def step(self, frame: np.ndarray) -> np.ndarray:
        """
        Process exactly one frame and return annotated frame.
        """
        annotated, events = self._run_detector(frame)

        # Standardize + store events
        for e in events:
            e.setdefault("type", self.mode)
            e.setdefault("confidence", None)
            e["mode"] = self.mode

            # Trigger actions first (snapshot/discord), then store enriched event
            meta = self.actions.trigger(e, frame)
            if meta:
                e["meta"] = meta

            self.store.add(e)

        self.last_frame = frame
        self.last_annotated = annotated
        return annotated

    def run_forever_generator(self):
        """
        Throttled generator used by the server to pull processed frames.
        """
        min_dt = 1.0 / max(1, CFG.fps_limit)
        while True:
            now = time.time()
            dt = now - self._last_time
            if dt < min_dt:
                time.sleep(min_dt - dt)
            self._last_time = time.time()
            yield

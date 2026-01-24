import time
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np

from config import CFG
from event_store import EventStore
from actions import Actions

Event = Dict[str, Any]

class Pipeline:
    """
    Core loop logic:
    frame -> detector -> (events, annotated_frame) -> store -> actions
    """
    def __init__(self, store: EventStore, actions: Actions):
        self.store = store
        self.actions = actions
        self.mode = CFG.default_mode  # "motion" or "gesture"

        # Detectors are provided by teammates; they must never open camera.
        # Expected detector function:
        #   annotated_frame, events = detector.process(frame)
        from detectors.motion_detector import MotionDetector  # Zohair
        from detectors.gesture_detector import GestureDetector  # Zohair

        self.motion = MotionDetector()
        self.gesture = GestureDetector()

        self.last_frame: np.ndarray | None = None
        self.last_annotated: np.ndarray | None = None
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

        # Standardize event format
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
        A throttled generator interface used by the server to pull processed frames.
        """
        min_dt = 1.0 / max(1, CFG.fps_limit)
        while True:
            now = time.time()
            dt = now - self._last_time
            if dt < min_dt:
                time.sleep(min_dt - dt)
            self._last_time = time.time()
            yield

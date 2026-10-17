"""Захват движения: веб-камера + MediaPipe Pose в фоновом потоке.

Если камеры или библиотек нет, игра продолжает работать — упражнения
можно «имитировать» клавишами (см. KEYBOARD_EXERCISES).
"""
import os
import queue
import threading
import time
import urllib.request

import pygame

from .exercises import ExerciseDetector

MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
             "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "pose_landmarker_lite.task")

# Запасное управление без камеры: клавиша -> события
KEYBOARD_EXERCISES = {
    pygame.K_1: ("pushup",),
    pygame.K_2: ("squat_down", "squat"),
    pygame.K_3: ("jack",),
}

# Пары точек для рисования «скелета» поверх кадра камеры
POSE_LINKS = [(11, 12), (11, 13), (13, 15), (12, 14), (14, 16), (11, 23), (12, 24),
              (23, 24), (23, 25), (25, 27), (24, 26), (26, 28)]

PREVIEW_W, PREVIEW_H = 160, 120


def ensure_model():
    if not os.path.exists(MODEL_PATH):
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        tmp = MODEL_PATH + ".part"
        urllib.request.urlretrieve(MODEL_URL, tmp)
        os.replace(tmp, MODEL_PATH)
    return MODEL_PATH


class PoseTracker(threading.Thread):
    def __init__(self, camera_index=0):
        super().__init__(daemon=True)
        self.camera_index = camera_index
        self.events = queue.Queue()
        self.detector = ExerciseDetector()
        self.status = "запуск камеры…"
        self.ok = False
        self.landmarks = None
        self._frame = None
        self._lock = threading.Lock()
        self._stop = threading.Event()

    def stop(self):
        self._stop.set()

    def latest_frame(self):
        with self._lock:
            return self._frame, self.landmarks

    def run(self):
        try:
            import cv2
            import mediapipe as mp
            from mediapipe.tasks.python import BaseOptions, vision
        except ImportError as exc:
            self.status = f"нет библиотеки: {exc.name}"
            return
        try:
            self.status = "загрузка модели позы…"
            model = ensure_model()
        except Exception as exc:  # нет сети и т.п.
            self.status = f"модель не загружена: {exc}"
            return

        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            self.status = "камера не найдена"
            return

        options = vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
        )
        start = time.monotonic()
        with vision.PoseLandmarker.create_from_options(options) as landmarker:
            self.ok = True
            self.status = "камера активна"
            last_ts = -1
            while not self._stop.is_set():
                got, frame = cap.read()
                if not got:
                    time.sleep(0.01)
                    continue
                frame = cv2.flip(frame, 1)  # зеркально — как в зеркале
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                t = time.monotonic() - start
                ts = max(int(t * 1000), last_ts + 1)
                last_ts = ts
                result = landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), ts)
                lm = None
                if result.pose_landmarks:
                    lm = [(p.x, p.y, p.visibility if p.visibility is not None else 1.0)
                          for p in result.pose_landmarks[0]]
                for ev in self.detector.update(lm, t):
                    self.events.put(ev)
                small = cv2.resize(rgb, (PREVIEW_W, PREVIEW_H))
                with self._lock:
                    self._frame = small.tobytes()
                    self.landmarks = lm
        cap.release()


class MotionInput:
    """Единая точка входа для упражнений: камера + клавиатура."""

    def __init__(self, use_camera=True, camera_index=0):
        self.tracker = None
        if use_camera:
            self.tracker = PoseTracker(camera_index)
            self.tracker.start()
        self.key_counts = {"pushup": 0, "squat": 0, "jack": 0}

    @property
    def status(self):
        return self.tracker.status if self.tracker else "камера отключена (--no-camera)"

    @property
    def camera_ok(self):
        return bool(self.tracker and self.tracker.ok)

    def poll(self, key_events):
        """Собирает события упражнений за кадр. key_events — KEYDOWN-события pygame."""
        out = []
        if self.tracker:
            while True:
                try:
                    out.append(self.tracker.events.get_nowait())
                except queue.Empty:
                    break
        for e in key_events:
            for ev in KEYBOARD_EXERCISES.get(e.key, ()):
                out.append(ev)
                if ev in self.key_counts:
                    self.key_counts[ev] += 1
        return out

    def detector(self):
        return self.tracker.detector if self.tracker else None

    def preview_surface(self, size=None):
        """Кадр камеры с наложенным скелетом позы (или None)."""
        if not self.tracker:
            return None
        frame, lm = self.tracker.latest_frame()
        if frame is None:
            return None
        surf = pygame.image.frombuffer(frame, (PREVIEW_W, PREVIEW_H), "RGB").copy()
        if lm:
            pts = [(int(x * PREVIEW_W), int(y * PREVIEW_H)) for x, y, _ in lm]
            for a, b in POSE_LINKS:
                if lm[a][2] > 0.5 and lm[b][2] > 0.5:
                    pygame.draw.line(surf, (255, 170, 60), pts[a], pts[b], 2)
            for i in {i for link in POSE_LINKS for i in link}:
                if lm[i][2] > 0.5:
                    pygame.draw.circle(surf, (255, 60, 40), pts[i], 2)
        if size:
            surf = pygame.transform.scale(surf, size)
        return surf

    def shutdown(self):
        if self.tracker:
            self.tracker.stop()

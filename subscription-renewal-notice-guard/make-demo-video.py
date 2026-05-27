from pathlib import Path
import json

try:
    import cv2
    import numpy as np
except ImportError as exc:
    raise SystemExit(
        "OpenCV and NumPy are required for demo video generation. "
        "Install opencv-python and numpy, then rerun this script."
    ) from exc


ROOT = Path(__file__).resolve().parent
REPORT_PATH = ROOT / "reports" / "renewal-notice-packet.json"
OUTPUT_PATH = ROOT / "reports" / "demo.mp4"


def draw_text(frame, text, x, y, size=0.8, color=(31, 41, 55), thickness=2):
    cv2.putText(
        frame,
        text,
        (x, y),
        cv2.FONT_HERSHEY_SIMPLEX,
        size,
        color,
        thickness,
        cv2.LINE_AA,
    )


def rounded_card(frame, x, y, width, height, fill, border=(203, 213, 225)):
    # OpenCV has no native rounded rectangle, so layered rectangles keep the card simple.
    cv2.rectangle(frame, (x + 12, y), (x + width - 12, y + height), fill, -1)
    cv2.rectangle(frame, (x, y + 12), (x + width, y + height - 12), fill, -1)
    cv2.circle(frame, (x + 12, y + 12), 12, fill, -1)
    cv2.circle(frame, (x + width - 12, y + 12), 12, fill, -1)
    cv2.circle(frame, (x + 12, y + height - 12), 12, fill, -1)
    cv2.circle(frame, (x + width - 12, y + height - 12), 12, fill, -1)
    cv2.rectangle(frame, (x, y), (x + width, y + height), border, 2)


def status_color(status):
    if status == "release":
        return (34, 197, 94)
    if status == "review":
        return (234, 179, 8)
    return (239, 68, 68)


def load_report():
    if not REPORT_PATH.exists():
        raise SystemExit("Run `npm run demo` before generating the demo video.")
    return json.loads(REPORT_PATH.read_text(encoding="utf-8"))


def build_frame(report, frame_index, total_frames):
    frame = np.full((720, 1280, 3), (248, 250, 252), dtype=np.uint8)
    metrics = report["metrics"]

    draw_text(frame, "Subscription Renewal Notice Guard", 56, 72, 1.15, (15, 23, 42), 3)
    draw_text(
        frame,
        "Pre-invoice compliance screen for SCIBASE revenue operations",
        58,
        112,
        0.62,
        (71, 85, 105),
        2,
    )

    progress = int(1120 * (frame_index + 1) / total_frames)
    cv2.rectangle(frame, (58, 136), (1178, 146), (226, 232, 240), -1)
    cv2.rectangle(frame, (58, 136), (58 + progress, 146), (14, 165, 233), -1)

    cards = [
        ("Renewals", str(metrics["totalRenewals"]), (14, 165, 233)),
        ("Released", str(metrics["release"]), (34, 197, 94)),
        ("Held", str(metrics["hold"]), (239, 68, 68)),
        ("Blockers", str(metrics["blockers"]), (245, 101, 101)),
        ("Warnings", str(metrics["warnings"]), (234, 179, 8)),
    ]

    for index, (label, value, color) in enumerate(cards):
        x = 58 + index * 232
        rounded_card(frame, x, 176, 200, 106, (255, 255, 255))
        draw_text(frame, label, x + 22, 216, 0.55, (71, 85, 105), 2)
        draw_text(frame, value, x + 22, 264, 1.25, color, 3)

    draw_text(frame, "Renewal decisions", 58, 340, 0.82, (15, 23, 42), 2)
    visible_rows = min(len(report["renewals"]), 1 + frame_index // max(1, total_frames // 5))

    for index, renewal in enumerate(report["renewals"][:visible_rows]):
        y = 374 + index * 70
        rounded_card(frame, 58, y, 1120, 54, (255, 255, 255))
        color = status_color(renewal["status"])
        cv2.circle(frame, (86, y + 28), 11, color, -1)
        draw_text(frame, renewal["account"], 112, y + 24, 0.58, (15, 23, 42), 2)
        draw_text(
            frame,
            f"{renewal['status']} | notice {renewal['daysOfNotice']}/{renewal['requiredNoticeDays']} days",
            112,
            y + 48,
            0.48,
            (71, 85, 105),
            1,
        )
        draw_text(
            frame,
            f"blockers {len(renewal['blockers'])}  warnings {len(renewal['warnings'])}",
            825,
            y + 34,
            0.52,
            (71, 85, 105),
            2,
        )

    draw_text(frame, "Output: reports/renewal-notice-packet.json, report.md, summary.svg", 58, 676, 0.52, (71, 85, 105), 1)
    draw_text(frame, f"Audit digest: {report['auditDigest'][:24]}...", 790, 676, 0.52, (71, 85, 105), 1)
    return frame


def main():
    report = load_report()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    frames_per_second = 24
    duration_seconds = 6
    total_frames = frames_per_second * duration_seconds
    writer = cv2.VideoWriter(
        str(OUTPUT_PATH),
        cv2.VideoWriter_fourcc(*"mp4v"),
        frames_per_second,
        (1280, 720),
    )

    if not writer.isOpened():
        raise SystemExit("Could not open MP4 writer with mp4v codec.")

    for frame_index in range(total_frames):
        writer.write(build_frame(report, frame_index, total_frames))

    writer.release()
    print(f"wrote {OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

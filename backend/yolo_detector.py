import onnxruntime as ort
import numpy as np
import cv2
import os
import uuid
from PIL import Image

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "best.onnx")
CROPS_DIR = os.path.join(os.path.dirname(__file__), "crops")
os.makedirs(CROPS_DIR, exist_ok=True)

INPUT_SIZE = 640
CONF_THRESHOLD = 0.25
IOU_THRESHOLD = 0.45
LOW_CONF_THRESHOLD = 0.80  # crops below this go to annotation

# Try to load class names from model metadata, fallback to generic
_session = None


def _get_session():
    global _session
    if _session is None:
        _session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
    return _session


def _get_class_names():
    sess = _get_session()
    meta = sess.get_modelmeta()
    if meta.custom_metadata_map and "names" in meta.custom_metadata_map:
        import ast
        raw = meta.custom_metadata_map["names"]
        try:
            names_dict = ast.literal_eval(raw)
            if isinstance(names_dict, dict):
                return [names_dict[i] for i in sorted(names_dict.keys())]
            elif isinstance(names_dict, list):
                return names_dict
        except Exception:
            pass
    # Fallback: determine number of classes from output shape
    out_shape = sess.get_outputs()[0].shape  # e.g. [1, 84, 8400] for YOLO
    if len(out_shape) >= 2:
        num_classes = out_shape[1] - 4 if out_shape[1] > 4 else 80
        return [f"class_{i}" for i in range(num_classes)]
    return [f"class_{i}" for i in range(80)]


def _preprocess(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")
    original_h, original_w = img.shape[:2]
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (INPUT_SIZE, INPUT_SIZE))
    img_float = img_resized.astype(np.float32) / 255.0
    img_transposed = np.transpose(img_float, (2, 0, 1))  # HWC -> CHW
    img_batch = np.expand_dims(img_transposed, axis=0)
    return img_batch, img, original_w, original_h


def _nms(boxes, scores, iou_threshold):
    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        iou = inter / (areas[i] + areas[order[1:]] - inter)
        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]
    return keep


def _postprocess(output, original_w, original_h, class_names):
    """Parse YOLO output (support both YOLOv8 and YOLOv5 formats)."""
    predictions = output[0]  # shape [1, num_attrs, num_boxes] or [1, num_boxes, num_attrs]
    
    # Handle YOLOv8 format: [1, 4+num_classes, num_boxes]
    if predictions.ndim == 3 and predictions.shape[1] < predictions.shape[2]:
        predictions = predictions[0].T  # -> [num_boxes, 4+num_classes]
    elif predictions.ndim == 3:
        predictions = predictions[0]    # -> [num_boxes, 4+num_classes]

    num_classes = len(class_names)
    boxes_list = []
    scores_list = []
    class_ids_list = []

    scale_x = original_w / INPUT_SIZE
    scale_y = original_h / INPUT_SIZE

    for pred in predictions:
        box_data = pred[:4]
        class_scores = pred[4:4 + num_classes]
        confidence = float(np.max(class_scores))
        class_id = int(np.argmax(class_scores))

        if confidence < CONF_THRESHOLD:
            continue

        cx, cy, w, h = box_data
        x1 = (cx - w / 2) * scale_x
        y1 = (cy - h / 2) * scale_y
        x2 = (cx + w / 2) * scale_x
        y2 = (cy + h / 2) * scale_y

        boxes_list.append([x1, y1, x2, y2])
        scores_list.append(confidence)
        class_ids_list.append(class_id)

    if not boxes_list:
        return [], [], []

    boxes_arr = np.array(boxes_list)
    scores_arr = np.array(scores_list)
    keep = _nms(boxes_arr, scores_arr, IOU_THRESHOLD)

    return (
        [boxes_list[i] for i in keep],
        [scores_list[i] for i in keep],
        [class_ids_list[i] for i in keep],
    )


def detect(image_path, session_id, image_type="pre_op"):
    """
    Run YOLO detection on an image.
    Returns:
        counts: dict {class_name: count}
        crops_info: list of dicts for low-confidence crops
    """
    class_names = _get_class_names()
    sess = _get_session()

    input_data, original_img, orig_w, orig_h = _preprocess(image_path)
    input_name = sess.get_inputs()[0].name
    outputs = sess.run(None, {input_name: input_data})

    boxes, scores, class_ids = _postprocess(outputs, orig_w, orig_h, class_names)

    counts = {}
    crops_info = []

    for box, score, class_id in zip(boxes, scores, class_ids):
        name = class_names[class_id] if class_id < len(class_names) else f"class_{class_id}"
        counts[name] = counts.get(name, 0) + 1

        # Save low-confidence crops
        if score < LOW_CONF_THRESHOLD:
            x1, y1, x2, y2 = [int(v) for v in box]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(orig_w, x2), min(orig_h, y2)

            crop = original_img[y1:y2, x1:x2]
            if crop.size > 0:
                crop_filename = f"{session_id}_{image_type}_{uuid.uuid4().hex[:8]}.jpg"
                crop_path = os.path.join(CROPS_DIR, crop_filename)
                cv2.imwrite(crop_path, crop)
                crops_info.append({
                    "filename": crop_filename,
                    "class_name": name,
                    "confidence": round(score, 4),
                    "image_type": image_type,
                })

    return counts, crops_info

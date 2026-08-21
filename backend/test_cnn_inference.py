import os
import sys
import numpy as np
import cv2

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.handwriting_cnn import load_model, predict_character_patches, CHARACTERS, NUM_CLASSES
from services.image_preprocessing import normalize_character_patch

def test_cnn_inference_standalone():
    print("=" * 60)
    print("      TESTING STANDALONE CNN HANDWRITING INFERENCE MODULE     ")
    print("=" * 60)

    # 1. Load Trained Model
    print(f"[1] Loading CNN model (Classes: {NUM_CLASSES})...")
    model = load_model()
    print("    [PASS] Model loaded successfully.")

    # 2. Generate sample character patches to test prediction
    test_chars = ["A", "B", "C", "T", "P", "5", "9", "X", "=", "+"]
    patches = []
    print(f"\n[2] Generating normalized 28x28 patches for test characters: {test_chars}")
    for char in test_chars:
        canvas = np.zeros((36, 36), dtype=np.uint8)
        (tw, th), _ = cv2.getTextSize(char, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)
        tx = max(1, (36 - tw) // 2)
        ty = max(th + 2, (36 + th) // 2)
        cv2.putText(canvas, char, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX, 0.8, 255, 2, cv2.LINE_AA)

        patch = normalize_character_patch(canvas, target_size=(28, 28))
        patches.append(patch)

    # 3. Run Batched Inference
    print("\n[3] Running CNN forward pass...")
    predictions = predict_character_patches(model, patches)
    
    print("\n[4] Inference Results:")
    print("-" * 60)
    correct_count = 0
    for target, pred in zip(test_chars, predictions):
        match = "MATCH" if target.upper() == pred.upper() else "DIFF"
        if target.upper() == pred.upper():
            correct_count += 1
        print(f"    Expected: '{target}'  -->  CNN Predicted: '{pred}'   [{match}]")
    print("-" * 60)
    acc = (correct_count / len(test_chars)) * 100
    print(f"    Top-1 Accuracy on synthetic test glyphs: {acc:.1f}%")
    assert acc >= 70.0, f"Accuracy too low: {acc}%"
    print("    [PASS] CNN character inference passed verification!")

    print("\n" + "=" * 60)
    print("         STANDALONE CNN INFERENCE TEST COMPLETED!            ")
    print("=" * 60)

if __name__ == "__main__":
    test_cnn_inference_standalone()

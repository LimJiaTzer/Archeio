from PIL import Image
import pillow_avif
import sys

input_path = sys.argv[1]
output_path = sys.argv[2]
quality = int(sys.argv[3])

img = Image.open(input_path)

# AVIF supports alpha, but RGB/RGBA is safest.
if img.mode not in ("RGB", "RGBA"):
    img = img.convert("RGBA")

img.save(output_path, "AVIF", quality=quality)
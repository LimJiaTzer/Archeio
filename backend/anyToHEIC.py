import sys
from PIL import Image
import pillow_heif

pillow_heif.register_heif_opener()

def convert_to_heic(input_path: str, output_path: str, quality: int = 80):
    try:
        img = Image.open(input_path)
        # Convert to RGB if necessary (HEIF supports more, but RGB is safe for standard images)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(output_path, format="HEIF", quality=quality)
        return True
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python anyToHEIC.py <input_path> <output_path> [quality]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    quality = int(sys.argv[3]) if len(sys.argv) > 3 else 80
    
    if convert_to_heic(input_file, output_file, quality):
        sys.exit(0)
    else:
        sys.exit(1)
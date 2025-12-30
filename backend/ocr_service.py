import sys
import os
import cv2
import pytesseract
import numpy as np
from PIL import Image
import tempfile
from pdf2image import convert_from_path

# --- CONFIGURATION ---
DEBUG_LOG = []
def log(msg):
    DEBUG_LOG.append(msg)
    print(msg)

TESSERACT_PATHS = [
    r'D:\Softwares\Python\Tesseract-OCR\tesseract.exe',
    r'C:\Program Files\Tesseract-OCR\tesseract.exe',
    r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    r'C:\Users\kadir\AppData\Local\Tesseract-OCR\tesseract.exe', 
    r'D:\Tesseract-OCR\tesseract.exe'
]

tesseract_cmd = None
log(f"[*] Checking Tesseract paths...")
for path in TESSERACT_PATHS:
    exists = os.path.exists(path)
    log(f"    - '{path}': {'FOUND' if exists else 'not found'}")
    if exists:
        tesseract_cmd = path
        break

if tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    log(f"[*] Selected Tesseract: {tesseract_cmd}")
else:
    log("[!] Error: Tesseract not found in list. Relying on PATH or default.")

class LectureOCR:
    def __init__(self):
        pass

    def preprocess_image(self, image_path):
        # 1. Read the image
        img = cv2.imread(image_path)
        if img is None:
            raise FileNotFoundError(f"Could not open image: {image_path}")

        # 2. Convert to Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 3. Apply Denoising
        gray = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)

        # 4. Apply Thresholding (Otsu)
        gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]

        return gray

    def extract_text_from_image(self, image_path, config=r'--oem 3 --psm 6'):
        try:
            processed_img = self.preprocess_image(image_path)
            text = pytesseract.image_to_string(processed_img, config=config)
            return text.strip()
        except Exception as e:
            return f"[Error page]: {str(e)}"

    def clean_text(self, text):
        import re
        
        # 1. NOISE REMOVAL (Headers/Footers)
        # Filters specific to "Operating System Concepts" book and common slide noise
        noise_patterns = [
            r"Silberschatz, Galvin and Gagne.*2018",
            r"Operating System Concepts.*Edition",
            r"^\s*\d+\.\d+\s*$",        # e.g., "6.2"
            r"^\s*\d+\s*$",             # e.g., "15" (just page number)
            r"^\s*Slide \d+\s*$"        # e.g., "Slide 11"
        ]
        
        cleaned_lines = []
        for line in text.splitlines():
            is_noise = False
            for pattern in noise_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    is_noise = True
                    break
            if not is_noise:
                cleaned_lines.append(line)
        
        text = "\n".join(cleaned_lines)

        # 2. BULLET POINT FIX (Merge orphan bullets)
        # Matches: Line containing only a bullet char (•, , -, *) followed by newline
        # Replaces with: Bullet + space + next line
        # Note: We do this iteratively or via regex multiline substitution
        # Pattern: (Start of line)(Bullet char)(Optional space)(End of line)\n(Next line content)
        bullet_pattern = r"(?m)^\s*([•\-\*])\s*\n\s*(.+)"
        text = re.sub(bullet_pattern, r"\1 \2", text)

        # 3. WHITESPACE NORMALIZATION
        # Collapse 3 or more newlines into 2
        text = re.sub(r'\n{3,}', '\n\n', text)

        return text

    def process_file(self, file_path):
        ext = os.path.splitext(file_path)[1].lower()
        full_text = []

        # Add Debug Info to top of file
        debug_header = "\n".join(DEBUG_LOG)
        full_text.append(f"--- DEBUG INFO ---\n{debug_header}\n------------------\n")

        raw_result_text = ""

        if ext == ".pdf":
            # Ensure temp_images directory exists
            temp_img_dir = os.path.join(os.getcwd(), "temp_images")
            os.makedirs(temp_img_dir, exist_ok=True)

            # STRATEGY 1: Direct Text Extraction (PyMuPDF)
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(file_path)
                print(f"[*] Analyzing PDF page by page ({len(doc)} pages)...")
                
                with tempfile.TemporaryDirectory() as temp_dir:
                    for i, page in enumerate(doc):
                        # A. TEXT EXTRACTION
                        text = page.get_text("text").strip()
                        
                        # Decide on text source (Digital vs OCR)
                        if len(text) > 50:
                            print(f"    Page {i+1}: Digital text found ({len(text)} chars).")
                            full_text.append(f"--- Slide {i+1} (Extracted) ---\n{text}\n")
                        else:
                            print(f"    Page {i+1}: Low text ({len(text)} chars). Applying OCR...")
                            pix = page.get_pixmap(dpi=300)
                            page_image_path = os.path.join(temp_dir, f"page_{i}.png")
                            pix.save(page_image_path)
                            ocr_text = self.extract_text_from_image(page_image_path, config=r'-l eng --psm 3')
                            full_text.append(f"--- Slide {i+1} (OCR) ---\n{ocr_text}\n")

                        # B. IMAGE EXTRACTION (For AI Analysis)
                        # Extract images associated with this page
                        image_list = page.get_images(full=True)
                        for img_index, img in enumerate(image_list):
                            xref = img[0]
                            width = img[2]
                            height = img[3]
                            
                            # FILTER 1: Dimensions
                            # Ignore small icons, bullets, logos, footer elements
                            # Diagrams are usually at least 200x200
                            if width < 200 or height < 200:
                                continue

                            base_image = doc.extract_image(xref)
                            image_bytes = base_image["image"]
                            
                            # FILTER 2: File Size
                            # Ignore tiny files (even if dimensions are artificially large)
                            # Threshold: 15KB
                            if len(image_bytes) < 15360:
                                continue

                            image_ext = base_image["ext"]
                            img_filename = f"slide_{i+1}_img_{img_index}_{os.getpid()}.{image_ext}"
                            img_path = os.path.join(temp_img_dir, img_filename)
                            
                            with open(img_path, "wb") as f_out:
                                f_out.write(image_bytes)
                            
                            # Insert marker for backend to process
                            full_text.append(f"\n[[[IMAGE_ANALYSIS_REQUIRED:{img_path}]]]\n")

            except ImportError:
                print("[!] PyMuPDF failed. Falling back to full OCR.")
                raw_result_text = self.fallback_full_ocr(file_path)
            except Exception as e:
                return f"Error processing PDF: {str(e)}"
            
            if not raw_result_text:
                raw_result_text = "\n".join(full_text)

        elif ext in [".jpg", ".jpeg", ".png", ".bmp"]:
            print(f"[*] Processing single image...")
            text = self.extract_text_from_image(file_path, config=r'-l eng --psm 3')
            full_text.append(text)
            raw_result_text = "\n".join(full_text)
        
        else:
            return "Unsupported file format."

        # Apply Post-Processing Cleaning
        print("[*] Cleaning text (removing headers, fixing bullets)...")
        final_text = self.clean_text(raw_result_text)
        return final_text


    def fallback_full_ocr(self, file_path):
        # Original full OCR logic for when PyMuPDF fails completely
        full_text = []
        try:
            images = convert_from_path(file_path, dpi=300)
            with tempfile.TemporaryDirectory() as temp_dir:
                for i, image in enumerate(images):
                    page_path = os.path.join(temp_dir, f"page_{i}.jpg")
                    image.save(page_path, "JPEG")
                    text = self.extract_text_from_image(page_path, config=r'-l eng --psm 3')
                    full_text.append(f"--- Slide {i+1} (OCR) ---\n{text}\n")
            return "\n".join(full_text)
        except Exception as e:
            return f"Error: {e}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ocr_service.py <file_path>")
        sys.exit(1)

    input_file = sys.argv[1]
    
    if not os.path.exists(input_file):
        print(f"Error: File not found {input_file}")
        sys.exit(1)

    ocr = LectureOCR()
    result = ocr.process_file(input_file)
    
    # Force UTF-8 for stdout (Windows fix)
    sys.stdout.reconfigure(encoding='utf-8')
    
    # Print result to stdout for Node.js to capture
    print("===OCR_START===")
    print(result)
    print("===OCR_END===")
